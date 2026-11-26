import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { moderationDecisionSchema } from "@pbs/validation";
import type { ListingStatus } from "@pbs/domain";
import type { AppContext } from "../context";
import { requireRole } from "../lib/auth";
import { notFound } from "../lib/errors";
import { ownerListing } from "../lib/serialize";
import { transition, fromRow } from "./listings";
import { validateForSubmit } from "@pbs/validation";

const include = { media: true, city: true, locality: true, owner: { select: { id: true, name: true, phone: true, createdAt: true } }, verifications: true, documents: { select: { id: true, label: true, mimeType: true, bytes: true, createdAt: true } } } as const;

export async function moderationRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;

  app.get("/v1/admin/listings", async (req) => {
    requireRole(req, "MODERATOR", "ADMIN");
    const q = z.object({ status: z.string().default("PENDING_REVIEW"), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
    const where = { status: q.status as ListingStatus };
    const [items, total] = await Promise.all([
      db.listing.findMany({ where, include, orderBy: { submittedAt: "asc" }, skip: (q.page - 1) * 25, take: 25 }),
      db.listing.count({ where }),
    ]);
    return { items: items.map((l) => ({ ...ownerListing(l), ownerPhone: l.owner.phone })), total, page: q.page };
  });

  app.get("/v1/admin/listings/:id", async (req) => {
    requireRole(req, "MODERATOR", "ADMIN");
    const l = await db.listing.findUnique({ where: { id: (req.params as { id: string }).id }, include });
    if (!l) throw notFound("Listing");
    const [reviews, reports, ownerListingCount] = await Promise.all([
      db.moderationReview.findMany({ where: { listingId: l.id }, orderBy: { createdAt: "desc" }, include: { moderator: { select: { name: true } } } }),
      db.report.findMany({ where: { listingId: l.id }, orderBy: { createdAt: "desc" } }),
      db.listing.count({ where: { ownerId: l.ownerId } }),
    ]);
    return {
      ...ownerListing(l),
      owner: { id: l.owner.id, name: l.owner.name, phone: l.owner.phone, memberSince: l.owner.createdAt, listingCount: ownerListingCount },
      documents: l.documents,
      checks: validateForSubmit(fromRow(l)),
      reviews, reports,
    };
  });

  app.post("/v1/admin/listings/:id/decision", async (req) => {
    const mod = requireRole(req, "MODERATOR", "ADMIN");
    const body = moderationDecisionSchema.parse(req.body);
    const l = await db.listing.findUnique({ where: { id: (req.params as { id: string }).id } });
    if (!l) throw notFound("Listing");
    const to = await transition(ctx, l, body.decision, "MODERATOR", mod.id);
    await db.moderationReview.create({ data: { listingId: l.id, moderatorId: mod.id, decision: body.decision, note: body.note ?? null, fromStatus: l.status, toStatus: to } });
    const msg = {
      APPROVE: { title: "Your listing is live", body: `"${l.title}" is now published.` },
      REQUEST_CHANGES: { title: "Changes requested", body: `A moderator asked for changes to "${l.title}": ${body.note}` },
      REJECT: { title: "Listing not approved", body: `"${l.title}" was not approved: ${body.note}` },
    }[body.decision];
    await db.notification.create({ data: { userId: l.ownerId, type: `LISTING_${body.decision}`, ...msg, link: `/dashboard/listings/${l.id}` } });
    return { status: to };
  });
}
