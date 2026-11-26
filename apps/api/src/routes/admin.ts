import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ROLES, type Role } from "@pbs/domain";
import type { AppContext } from "../context";
import { requireRole } from "../lib/auth";
import { HttpError, notFound, conflict } from "../lib/errors";
import { audit } from "../lib/audit";
import { transition } from "./listings";

const DAY = 86_400_000;
const reportActionSchema = z.object({ action: z.enum(["START_REVIEW", "DISMISS", "TAKE_DOWN"]), note: z.string().trim().max(1000).optional() });
const rolesSchema = z.object({ roles: z.array(z.enum(ROLES as unknown as [Role, ...Role[]])).max(7) });
const blockSchema = z.object({ blocked: z.boolean(), reason: z.string().trim().min(3).max(500) });
const maskPhone = (p: string) => p.replace(/^(\+?\d{4})\d+(\d{2})$/, "$1••••••$2");

export async function adminRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;

  // ---------- Reports queue (moderators and support) ----------
  app.get<{ Querystring: { status?: string } }>("/v1/admin/reports", async (req) => {
    requireRole(req, "MODERATOR", "SUPPORT", "ADMIN");
    const status = ["OPEN", "IN_REVIEW", "ACTIONED", "DISMISSED"].includes(req.query.status ?? "") ? req.query.status : undefined;
    const rows = await db.report.findMany({
      where: status ? { status: status as never } : { status: { in: ["OPEN", "IN_REVIEW"] } },
      include: { listing: { select: { id: true, title: true, status: true, ownerId: true, _count: { select: { reports: true } } } }, reporter: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" }, take: 100,
    });
    return { items: rows.map((r) => ({
      id: r.id, reason: r.reason, details: r.details, status: r.status, resolution: r.resolution, createdAt: r.createdAt,
      reporter: r.reporter, listing: r.listing ? { id: r.listing.id, title: r.listing.title, status: r.listing.status, reportCount: r.listing._count.reports } : null,
    })) };
  });

  app.post<{ Params: { id: string } }>("/v1/admin/reports/:id/action", async (req) => {
    const u = requireRole(req, "MODERATOR", "ADMIN");
    const body = reportActionSchema.parse(req.body);
    const r = await db.report.findUnique({ where: { id: req.params.id }, include: { listing: true } });
    if (!r) throw notFound("Report");
    if (["ACTIONED", "DISMISSED"].includes(r.status)) throw conflict("This report is already closed");
    if (body.action === "START_REVIEW") {
      await db.report.update({ where: { id: r.id }, data: { status: "IN_REVIEW" } });
    } else if (body.action === "DISMISS") {
      await db.report.update({ where: { id: r.id }, data: { status: "DISMISSED", resolution: body.note ?? "No breach found" } });
    } else {
      if (!r.listing) throw new HttpError(409, "NO_LISTING", "The reported listing no longer exists");
      if (!body.note) throw new HttpError(400, "NOTE_REQUIRED", "Explain to the owner what must change");
      if (["PUBLISHED", "PAUSED"].includes(r.listing.status)) await transition(ctx, r.listing, "TAKE_DOWN", "MODERATOR", u.id);
      await db.report.updateMany({ where: { listingId: r.listing.id, status: { in: ["OPEN", "IN_REVIEW"] } }, data: { status: "ACTIONED", resolution: body.note } });
      await db.notification.create({ data: { userId: r.listing.ownerId, type: "LISTING_TAKEN_DOWN", title: "Listing hidden for changes", body: `"${r.listing.title}" was hidden after a review: ${body.note}`, link: `/post-property/${r.listing.id}` } });
    }
    await audit(db, u.id, `REPORT_${body.action}`, "Report", r.id, { listingId: r.listingId, note: body.note });
    return db.report.findUniqueOrThrow({ where: { id: r.id } });
  });

  // ---------- Users and roles (admin; support can look up) ----------
  app.get<{ Querystring: { q?: string; role?: string } }>("/v1/admin/users", async (req) => {
    const viewer = requireRole(req, "ADMIN", "SUPPORT");
    const q = (req.query.q ?? "").trim().slice(0, 60);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (q) where.OR = [{ phone: { contains: q.replace(/\s/g, "") } }, { name: { contains: q, mode: "insensitive" } }];
    if (req.query.role && (ROLES as readonly string[]).includes(req.query.role)) where.roles = { some: { role: req.query.role as Role } };
    const rows = await db.user.findMany({ where, include: { roles: true, _count: { select: { listings: true, reports: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
    const full = viewer.roles.includes("ADMIN");
    return { items: rows.map((x) => ({
      id: x.id, name: x.name, phone: full ? x.phone : maskPhone(x.phone), roles: x.roles.map((r) => r.role), createdAt: x.createdAt,
      blocked: !!x.blockedAt, isDemo: x.isDemo, listingCount: x._count.listings, reportsMade: x._count.reports,
    })) };
  });

  app.put<{ Params: { id: string } }>("/v1/admin/users/:id/roles", async (req) => {
    const admin = requireRole(req, "ADMIN");
    const { roles } = rolesSchema.parse(req.body);
    const target = await db.user.findUnique({ where: { id: req.params.id }, include: { roles: true } });
    if (!target) throw notFound("User");
    if (target.id === admin.id && !roles.includes("ADMIN")) throw conflict("You cannot remove your own admin role");
    const before = target.roles.map((r) => r.role);
    const wanted = [...new Set(roles)];
    await db.$transaction([
      db.userRole.deleteMany({ where: { userId: target.id, role: { notIn: wanted } } }),
      ...wanted.filter((r) => !before.includes(r)).map((role) => db.userRole.create({ data: { userId: target.id, role } })),
      // force a fresh login so new tokens carry the new roles
      db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit(db, admin.id, "USER_ROLES_SET", "User", target.id, { before, after: wanted });
    return { id: target.id, roles: wanted };
  });

  app.post<{ Params: { id: string } }>("/v1/admin/users/:id/block", async (req) => {
    const admin = requireRole(req, "ADMIN");
    const body = blockSchema.parse(req.body);
    if (req.params.id === admin.id) throw conflict("You cannot block yourself");
    const target = await db.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound("User");
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { blockedAt: body.blocked ? new Date() : null } }),
      ...(body.blocked ? [db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
    ]);
    await audit(db, admin.id, body.blocked ? "USER_BLOCKED" : "USER_UNBLOCKED", "User", target.id, { reason: body.reason });
    return { id: target.id, blocked: body.blocked };
  });

  // ---------- Audit log (admin) ----------
  app.get<{ Querystring: { entityType?: string; entityId?: string; actorId?: string; action?: string; before?: string } }>("/v1/admin/audit", async (req) => {
    requireRole(req, "ADMIN");
    const { entityType, entityId, actorId, action, before } = req.query;
    const where: Prisma.AuditLogWhereInput = {};
    if (entityType) where.entityType = entityType.slice(0, 40);
    if (entityId) where.entityId = entityId.slice(0, 40);
    if (actorId) where.actorId = actorId.slice(0, 40);
    if (action) where.action = { contains: action.slice(0, 40), mode: "insensitive" };
    if (before && !Number.isNaN(Date.parse(before))) where.createdAt = { lt: new Date(before) };
    const rows = await db.auditLog.findMany({ where, include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
    return { items: rows.map((r) => ({ id: r.id, action: r.action, entityType: r.entityType, entityId: r.entityId, meta: r.meta, createdAt: r.createdAt, actor: r.actor })), nextBefore: rows.length === 100 ? rows.at(-1)!.createdAt.toISOString() : null };
  });

  // ---------- Metrics (admin): the launch KPIs from the business plan ----------
  app.get("/v1/admin/metrics", async (req) => {
    requireRole(req, "ADMIN");
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * DAY), d30 = new Date(now.getTime() - 30 * DAY);
    const real = { isDemo: false };
    const [usersTotal, users7, byStatus, pendingOldest, enquiries7, enquiries30, live, reportsOpen, revenue30, reviews30, advertisers30] = await Promise.all([
      db.user.count({ where: { ...real, deletedAt: null } }),
      db.user.count({ where: { ...real, createdAt: { gte: d7 } } }),
      db.listing.groupBy({ by: ["status"], where: real, _count: { _all: true } }),
      db.listing.findFirst({ where: { status: "PENDING_REVIEW" }, orderBy: { submittedAt: "asc" }, select: { submittedAt: true } }),
      db.enquiry.count({ where: { createdAt: { gte: d7 }, listing: real } }),
      db.enquiry.count({ where: { createdAt: { gte: d30 }, listing: real } }),
      db.listing.count({ where: { ...real, status: "PUBLISHED", expiresAt: { gt: now } } }),
      db.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
      db.order.aggregate({ where: { status: "PAID", updatedAt: { gte: d30 } }, _sum: { totalPaise: true, amountPaise: true }, _count: { _all: true } }),
      db.moderationReview.findMany({ where: { createdAt: { gte: d30 }, listing: real }, select: { createdAt: true, listing: { select: { submittedAt: true } } }, take: 2000 }),
      db.listing.findMany({ where: { ...real, publishedAt: { gte: d30 } }, distinct: ["ownerId"], select: { ownerId: true } }),
    ]);
    const waits = reviews30.map((r) => (r.listing.submittedAt ? (r.createdAt.getTime() - r.listing.submittedAt.getTime()) / 3_600_000 : null)).filter((h): h is number => h !== null && h >= 0).sort((a, b) => a - b);
    const median = waits.length ? waits[Math.floor(waits.length / 2)]! : null;
    return {
      generatedAt: now, excludesDemoData: true,
      users: { total: usersTotal, new7d: users7 },
      listings: { live, byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])), activeAdvertisers30d: advertisers30.length },
      moderation: { pending: byStatus.find((b) => b.status === "PENDING_REVIEW")?._count._all ?? 0, oldestPendingHours: pendingOldest?.submittedAt ? Math.round((now.getTime() - pendingOldest.submittedAt.getTime()) / 3_600_000) : null, medianReviewHours30d: median === null ? null : Math.round(median * 10) / 10, openReports: reportsOpen },
      demand: { enquiries7d: enquiries7, enquiries30d: enquiries30, enquiriesPerLiveListing30d: live ? Math.round((enquiries30 / live) * 100) / 100 : null },
      revenue: { paidOrders30d: revenue30._count._all, grossPaise30d: revenue30._sum.totalPaise ?? 0n, netOfGstPaise30d: revenue30._sum.amountPaise ?? 0n },
    };
  });
}
