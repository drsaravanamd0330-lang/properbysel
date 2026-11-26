import type { PrismaClient } from "@prisma/client";
import { audit } from "./lib/audit";

/** Expire published/paused listings past their expiry date. Safe to run repeatedly. */
export async function expireListings(db: PrismaClient, now = new Date()) {
  const due = await db.listing.findMany({ where: { status: { in: ["PUBLISHED", "PAUSED"] }, expiresAt: { lte: now } }, select: { id: true, status: true, ownerId: true, title: true } });
  for (const l of due) {
    const r = await db.listing.updateMany({ where: { id: l.id, status: l.status }, data: { status: "EXPIRED" } });
    if (r.count) {
      await audit(db, null, "LISTING_EXPIRE", "Listing", l.id, { from: l.status });
      await db.notification.create({ data: { userId: l.ownerId, type: "LISTING_EXPIRED", title: "Listing expired", body: `"${l.title}" has expired. Renew it to show it again.`, link: `/dashboard/listings/${l.id}` } });
    }
  }
  return due.length;
}

/**
 * Saved-search alerts: one in-app notification per saved search when new matching listings were published
 * since the last alert. Uses an atomic claim on lastAlertedAt so overlapping runs cannot double-notify.
 */
export async function sendSavedSearchAlerts(db: PrismaClient, now = new Date()) {
  const { searchFilters } = await import("./routes/public");
  const { searchQuerySchema } = await import("@pbs/validation");
  const searches = await db.savedSearch.findMany({ where: { alerts: true, user: { blockedAt: null, deletedAt: null } }, take: 5000 });
  let sent = 0;
  for (const s of searches) {
    const since = s.lastAlertedAt ?? s.createdAt;
    const parsed = searchQuerySchema.safeParse(s.query ?? {});
    if (!parsed.success) continue;
    const where = { AND: [...searchFilters(parsed.data, now), { publishedAt: { gt: since, lte: now } }, { ownerId: { not: s.userId } }] };
    const count = await db.listing.count({ where });
    const claim = await db.savedSearch.updateMany({ where: { id: s.id, lastAlertedAt: s.lastAlertedAt }, data: { lastAlertedAt: now } });
    if (!claim.count || count === 0) continue;
    const qs = new URLSearchParams(Object.entries(s.query as Record<string, unknown>).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, String(x)]) : [[k, String(v)]]))).toString();
    await db.notification.create({ data: { userId: s.userId, type: "SAVED_SEARCH_MATCH", title: `${count} new ${count === 1 ? "property" : "properties"} for “${s.name}”`, body: "New listings match your saved search.", link: `/search?${qs}&sort=newest` } });
    sent++;
  }
  return sent;
}
