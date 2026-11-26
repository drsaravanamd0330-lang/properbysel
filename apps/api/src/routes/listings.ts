import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma, Listing } from "@prisma/client";
import { listingDraftSchema, validateForSubmit, type ListingDraftInput } from "@pbs/validation";
import {
  nextStatus, actorFor, FREELY_EDITABLE, MATERIAL_FIELDS, LISTING_TTL_DAYS, CATEGORY_GROUP, toSqft,
  TransitionError, type ListingAction, type ListingStatus, type AreaUnit,
} from "@pbs/domain";
import type { AppContext } from "../context";
import { requireUser, type AuthUser } from "../lib/auth";
import { HttpError, notFound, forbidden, conflict } from "../lib/errors";
import { ownerListing } from "../lib/serialize";
import { audit } from "../lib/audit";

const include = { media: true, city: true, locality: true, owner: { select: { id: true, name: true } }, verifications: true } as const;

/** Columns derived from attributes and prices, used for indexed search. */
export function derived(l: Pick<Listing, "category" | "transaction" | "pricePaise" | "rentPaise" | "leasePaise" | "attributes">) {
  const a = (l.attributes ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Number(v));
  const out: Prisma.ListingUpdateInput = {};
  const group = l.category ? CATEGORY_GROUP[l.category] : undefined;
  if (group === "RESIDENTIAL") {
    out.bedrooms = n(a.bedrooms) ?? null;
    out.furnishing = (a.furnishing as Listing["furnishing"]) ?? null;
    const area = n(a.carpetAreaSqft) ?? n(a.builtUpAreaSqft) ?? n(a.superBuiltUpAreaSqft);
    out.areaSqft = area ?? null; out.areaValue = area ?? null; out.areaUnit = area ? "SQFT" : null;
  } else if (group === "LAND") {
    const v = n(a.plotArea); const unit = (a.plotAreaUnit as AreaUnit) ?? "SQFT";
    out.bedrooms = null; out.furnishing = null;
    out.areaValue = v ?? null; out.areaUnit = v ? unit : null; out.areaSqft = v ? toSqft(v, unit) : null;
  } else if (group === "COMMERCIAL") {
    const v = n(a.builtUpAreaSqft);
    out.bedrooms = null; out.furnishing = null; out.areaSqft = v ?? null; out.areaValue = v ?? null; out.areaUnit = v ? "SQFT" : null;
  }
  out.sortPricePaise = l.transaction === "SALE" ? l.pricePaise : l.transaction === "RENT" ? l.rentPaise : l.transaction === "LEASE" ? l.leasePaise : null;
  return out;
}

export async function loadOwned(ctx: AppContext, id: string, u: AuthUser) {
  const l = await ctx.db.listing.findUnique({ where: { id }, include });
  if (!l) throw notFound("Listing");
  const actor = actorFor(l.ownerId === u.id, u.roles);
  if (!actor) throw notFound("Listing"); // do not reveal existence to other users
  return { l, actor };
}

export async function transition(ctx: AppContext, l: Listing, action: ListingAction, actor: "OWNER" | "MODERATOR" | "SYSTEM", actorId: string | null, extra: Prisma.ListingUpdateInput = {}) {
  let to: ListingStatus;
  try { to = nextStatus(l.status, action, actor); } catch (e) {
    if (e instanceof TransitionError) throw conflict(e.message);
    throw e;
  }
  const now = new Date();
  const data: Prisma.ListingUpdateInput = { status: to, ...extra };
  if (to === "PENDING_REVIEW") data.submittedAt = now;
  if (to === "PUBLISHED" && action === "APPROVE") { data.publishedAt = now; data.expiresAt = new Date(now.getTime() + LISTING_TTL_DAYS * 86400_000); }
  if (to === "SOLD" || to === "RENTED" || to === "ARCHIVED") data.closedAt = now;
  // Optimistic concurrency: only update if status is unchanged since we read it.
  const res = await ctx.db.listing.updateMany({ where: { id: l.id, status: l.status }, data: data as Prisma.ListingUpdateManyMutationInput });
  if (res.count !== 1) throw conflict("This listing was changed by someone else. Reload and try again.");
  await audit(ctx.db, actorId, `LISTING_${action}`, "Listing", l.id, { from: l.status, to });
  return to;
}

const actionSchema = z.object({ action: z.enum(["PAUSE", "RESUME", "MARK_SOLD", "MARK_RENTED", "ARCHIVE", "RENEW"]) });

export async function listingRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;

  app.post("/v1/listings", { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req, reply) => {
    const u = requireUser(req);
    const drafts = await db.listing.count({ where: { ownerId: u.id, status: "DRAFT" } });
    if (drafts >= 20) throw new HttpError(429, "TOO_MANY_DRAFTS", "You have too many drafts. Finish or delete some first.");
    const body = listingDraftSchema.parse(req.body ?? {});
    const l = await db.listing.create({ data: { ...toData(body), ownerId: u.id }, include });
    await db.listing.update({ where: { id: l.id }, data: derived(l) });
    if (!u.roles.includes("ADVERTISER")) await db.userRole.upsert({ where: { userId_role: { userId: u.id, role: "ADVERTISER" } }, create: { userId: u.id, role: "ADVERTISER" }, update: {} });
    await audit(db, u.id, "LISTING_CREATE", "Listing", l.id);
    reply.code(201);
    return ownerListing(await db.listing.findUniqueOrThrow({ where: { id: l.id }, include }));
  });

  app.get("/v1/me/listings", async (req) => {
    const u = requireUser(req);
    const q = z.object({ status: z.string().optional() }).parse(req.query);
    const rows = await db.listing.findMany({ where: { ownerId: u.id, ...(q.status ? { status: q.status as ListingStatus } : { status: { not: "ARCHIVED" } }) }, include, orderBy: { updatedAt: "desc" } });
    const counts = await db.enquiry.groupBy({ by: ["listingId"], where: { listingId: { in: rows.map((r) => r.id) } }, _count: true });
    const cmap = new Map(counts.map((c) => [c.listingId, c._count]));
    return { items: rows.map((r) => ({ ...ownerListing(r), enquiryCount: cmap.get(r.id) ?? 0 })) };
  });

  app.get("/v1/listings/:id", async (req) => {
    const u = requireUser(req);
    const { l } = await loadOwned(ctx, (req.params as { id: string }).id, u);
    const lastReview = await db.moderationReview.findFirst({ where: { listingId: l.id }, orderBy: { createdAt: "desc" } });
    return { ...ownerListing(l), lastReview: lastReview && l.ownerId === u.id && lastReview.decision !== "APPROVE" ? { decision: lastReview.decision, note: lastReview.note, at: lastReview.createdAt } : lastReview };
  });

  /** Autosave / edit. */
  app.patch("/v1/listings/:id", async (req) => {
    const u = requireUser(req);
    const { l, actor } = await loadOwned(ctx, (req.params as { id: string }).id, u);
    if (actor !== "OWNER") throw forbidden("Only the advertiser can edit this listing");
    const body = listingDraftSchema.parse(req.body ?? {});
    const data = toData(body);
    if (body.cityId && body.localityId) {
      const loc = await db.locality.findUnique({ where: { id: body.localityId } });
      if (!loc || loc.cityId !== body.cityId) throw new HttpError(400, "VALIDATION", "Locality does not belong to that city");
    }

    if (FREELY_EDITABLE.includes(l.status)) {
      // ok
    } else if (l.status === "PUBLISHED" || l.status === "PAUSED") {
      const material = MATERIAL_FIELDS.some((f) => f in body && JSON.stringify((body as Record<string, unknown>)[f]) !== JSON.stringify(normalize((l as Record<string, unknown>)[f])));
      if (material) {
        const updated = await db.listing.update({ where: { id: l.id }, data, include });
        await db.listing.update({ where: { id: l.id }, data: derived(updated) });
        await transition(ctx, updated, "EDIT_MATERIAL", "OWNER", u.id);
        return { ...ownerListing(await db.listing.findUniqueOrThrow({ where: { id: l.id }, include })), notice: "Your changes will be visible after review." };
      }
    } else {
      throw conflict(`This listing cannot be edited while it is ${l.status.toLowerCase().replace("_", " ")}`);
    }
    const updated = await db.listing.update({ where: { id: l.id }, data, include });
    await db.listing.update({ where: { id: l.id }, data: derived(updated) });
    return ownerListing(await db.listing.findUniqueOrThrow({ where: { id: l.id }, include }));
  });

  app.post("/v1/listings/:id/submit", async (req) => {
    const u = requireUser(req);
    const { l, actor } = await loadOwned(ctx, (req.params as { id: string }).id, u);
    if (actor !== "OWNER") throw forbidden();
    const issues = validateForSubmit({ ...fromRow(l), mediaCount: l.media.length });
    if (issues.length) throw new HttpError(422, "INCOMPLETE", "Some details are missing", issues);
    await transition(ctx, l, "SUBMIT", "OWNER", u.id);
    return ownerListing(await db.listing.findUniqueOrThrow({ where: { id: l.id }, include }));
  });

  app.post("/v1/listings/:id/actions", async (req) => {
    const u = requireUser(req);
    const { action } = actionSchema.parse(req.body);
    const { l, actor } = await loadOwned(ctx, (req.params as { id: string }).id, u);
    await transition(ctx, l, action, actor, u.id);
    return ownerListing(await db.listing.findUniqueOrThrow({ where: { id: l.id }, include }));
  });

  app.delete("/v1/listings/:id", async (req) => {
    const u = requireUser(req);
    const { l, actor } = await loadOwned(ctx, (req.params as { id: string }).id, u);
    if (actor !== "OWNER" || l.status !== "DRAFT") throw conflict("Only drafts can be deleted. Archive other listings instead.");
    await db.listing.delete({ where: { id: l.id } });
    await audit(db, u.id, "LISTING_DELETE_DRAFT", "Listing", l.id);
    return { ok: true };
  });
}

function normalize(v: unknown) { return typeof v === "bigint" ? Number(v) : v; }

function toData(b: ListingDraftInput): Prisma.ListingUncheckedUpdateInput & Prisma.ListingUncheckedCreateInput {
  const d: Record<string, unknown> = { ...b };
  for (const k of ["pricePaise", "rentPaise", "leasePaise", "depositPaise", "maintenancePaise"] as const) {
    if (b[k] !== undefined) d[k] = BigInt(b[k]!);
  }
  if (b.postcode === "") d.postcode = null;
  return d as Prisma.ListingUncheckedUpdateInput & Prisma.ListingUncheckedCreateInput;
}

export function fromRow(l: Listing): ListingDraftInput {
  const opt = <T>(v: T | null) => (v === null ? undefined : v);
  return {
    advertiserType: opt(l.advertiserType), transaction: opt(l.transaction), category: opt(l.category),
    title: opt(l.title), description: opt(l.description), cityId: opt(l.cityId), localityId: opt(l.localityId),
    attributes: l.attributes as Record<string, unknown>, contactConsent: l.contactConsent,
    pricePaise: l.pricePaise === null ? undefined : Number(l.pricePaise),
    rentPaise: l.rentPaise === null ? undefined : Number(l.rentPaise),
    leasePaise: l.leasePaise === null ? undefined : Number(l.leasePaise),
    brokerageDisclosure: opt(l.brokerageDisclosure),
  };
}
