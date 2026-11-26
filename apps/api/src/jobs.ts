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
