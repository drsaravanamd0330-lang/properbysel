import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { searchQuerySchema, reportSchema } from "@pbs/validation";
import type { AppContext } from "../context";
import { notFound, HttpError } from "../lib/errors";
import { publicListing } from "../lib/serialize";
import { requireUser } from "../lib/auth";
import { audit } from "../lib/audit";

type SearchQuery = z.infer<typeof searchQuerySchema>;
const include = { media: true, city: true, locality: true, owner: { select: { id: true, name: true } }, verifications: true } as const;
const arr = <T>(v: T | T[] | undefined): T[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

/** The single definition of "publicly visible". */
export const publicWhere = (now = new Date()): Prisma.ListingWhereInput => ({ status: "PUBLISHED", expiresAt: { gt: now } });

/** Builds the search filter. Shared by public search and saved-search alerts. */
export function searchFilters(q: SearchQuery, now = new Date()): Prisma.ListingWhereInput[] {
  const and: Prisma.ListingWhereInput[] = [publicWhere(now)];
  if (q.city) and.push({ city: { slug: q.city } });
  if (q.locality) and.push({ locality: { slug: q.locality } });
  if (q.postcode) and.push({ OR: [{ postcode: q.postcode }, { locality: { postcodes: { has: q.postcode } } }] });
  if (q.transaction) and.push({ transaction: q.transaction });
  const cats = arr(q.category); if (cats) and.push({ category: { in: cats } });
  if (q.minPrice !== undefined) and.push({ sortPricePaise: { gte: BigInt(q.minPrice) * 100n } });
  if (q.maxPrice !== undefined) and.push({ sortPricePaise: { lte: BigInt(q.maxPrice) * 100n } });
  if (q.minArea !== undefined) and.push({ areaSqft: { gte: q.minArea } });
  if (q.maxArea !== undefined) and.push({ areaSqft: { lte: q.maxArea } });
  const beds = arr(q.bedrooms); if (beds) and.push(beds.includes(5) ? { OR: [{ bedrooms: { in: beds } }, { bedrooms: { gte: 5 } }] } : { bedrooms: { in: beds } });
  if (q.furnishing) and.push({ furnishing: q.furnishing });
  if (q.advertiserType) and.push({ advertiserType: q.advertiserType });
  const am = arr(q.amenities); if (am) and.push({ amenities: { hasEvery: am } });
  if (q.bbox) {
    const [minLng, minLat, maxLng, maxLat] = q.bbox.split(",").map(Number) as [number, number, number, number];
    and.push({ lat: { gte: minLat, lte: maxLat }, lng: { gte: minLng, lte: maxLng } });
  }
  if (q.q) {
    const t = q.q;
    and.push({ OR: [
      { title: { contains: t, mode: "insensitive" } }, { description: { contains: t, mode: "insensitive" } },
      { landmark: { contains: t, mode: "insensitive" } }, { postcode: t },
      { locality: { name: { contains: t, mode: "insensitive" } } }, { city: { name: { contains: t, mode: "insensitive" } } },
    ] });
  }
  return and;
}

export async function publicRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;

  app.get("/v1/cities", async () => {
    const cities = await db.city.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return { items: cities.map((c) => ({ id: c.id, name: c.name, slug: c.slug, state: c.state })) };
  });

  app.get("/v1/cities/:slug/localities", async (req) => {
    const city = await db.city.findUnique({ where: { slug: (req.params as { slug: string }).slug }, include: { localities: { orderBy: { name: "asc" } } } });
    if (!city) throw notFound("City");
    return { city: { id: city.id, name: city.name, slug: city.slug }, items: city.localities.map((l) => ({ id: l.id, name: l.name, slug: l.slug, postcodes: l.postcodes })) };
  });

  app.get("/v1/search", async (req) => {
    const q = searchQuerySchema.parse(req.query);
    const now = new Date();
    const and = searchFilters(q, now);
    const where: Prisma.ListingWhereInput = { AND: and };
    const orderBy: Prisma.ListingOrderByWithRelationInput[] =
      q.sort === "newest" ? [{ publishedAt: "desc" }, { id: "asc" }]
      : q.sort === "price_asc" ? [{ sortPricePaise: "asc" }, { id: "asc" }]
      : q.sort === "price_desc" ? [{ sortPricePaise: "desc" }, { id: "asc" }]
      : [{ publishedAt: "desc" }, { id: "asc" }];

    let featured: Awaited<ReturnType<typeof db.listing.findMany<{ include: typeof include }>>> = [];
    if (q.sort === "relevance" && q.page === 1) {
      // Paid placement: at most 3 sponsored results, only while the placement is active.
      featured = await db.listing.findMany({ where: { AND: [...and, { featuredUntil: { gt: now } }] }, include, orderBy: { featuredUntil: "desc" }, take: 3 });
    }
    const [rows, total] = await Promise.all([
      db.listing.findMany({ where, include, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      db.listing.count({ where }),
    ]);
    const featuredIds = new Set(featured.map((f) => f.id));
    const items = [...featured, ...rows.filter((r) => !featuredIds.has(r.id))].map((l) => publicListing(l, now));
    return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  });

  app.get("/v1/properties/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const l = await db.listing.findUnique({ where: { id }, include });
    if (!l) throw notFound("Property");
    const now = new Date();
    const visible = l.status === "PUBLISHED" && !!l.expiresAt && l.expiresAt > now;
    if (!visible) {
      // Closed listings return a minimal "gone" response so pages can show a clear message (and noindex).
      if (["SOLD", "RENTED", "EXPIRED", "ARCHIVED", "PAUSED"].includes(l.status) && l.publishedAt) {
        throw new HttpError(410, "LISTING_UNAVAILABLE", "This property is no longer available", { status: l.status === "PUBLISHED" ? "EXPIRED" : l.status, title: l.title, citySlug: undefined });
      }
      throw notFound("Property");
    }
    return publicListing(l, now);
  });

  app.get("/v1/properties/:id/similar", async (req) => {
    const id = (req.params as { id: string }).id;
    const l = await db.listing.findUnique({ where: { id } });
    if (!l) throw notFound("Property");
    const rows = await db.listing.findMany({
      where: { AND: [publicWhere(), { id: { not: id }, cityId: l.cityId, transaction: l.transaction, category: l.category }] },
      include, take: 6, orderBy: { publishedAt: "desc" },
    });
    return { items: rows.map((r) => publicListing(r)) };
  });

  /** Phone reveal: only when the advertiser opted in and the viewer has sent an enquiry. */
  app.get("/v1/properties/:id/contact", async (req) => {
    const u = requireUser(req);
    const id = (req.params as { id: string }).id;
    const l = await db.listing.findFirst({ where: { AND: [publicWhere(), { id }] }, include: { owner: { select: { phone: true, name: true } } } });
    if (!l) throw notFound("Property");
    const enquired = await db.enquiry.findUnique({ where: { listingId_buyerId: { listingId: id, buyerId: u.id } } });
    if (!l.showPhone) return { available: false, reason: "The advertiser prefers to be contacted through ProperBySel messages." };
    if (!enquired) return { available: false, reason: "Send an enquiry first to see the phone number." };
    await audit(db, u.id, "CONTACT_REVEALED", "Listing", id);
    return { available: true, name: l.owner.name, phone: l.owner.phone };
  });

  app.post("/v1/properties/:id/report", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const u = requireUser(req);
    const id = (req.params as { id: string }).id;
    const body = reportSchema.parse(req.body);
    const l = await db.listing.findUnique({ where: { id } });
    if (!l) throw notFound("Property");
    const r = await db.report.create({ data: { listingId: id, reporterId: u.id, reason: body.reason, details: body.details ?? null } });
    reply.code(201);
    return { id: r.id, status: r.status };
  });
}
