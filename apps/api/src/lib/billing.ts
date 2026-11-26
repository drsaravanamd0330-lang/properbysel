import { Prisma, type PrismaClient } from "@prisma/client";
import type { AppContext } from "../context";
import type { PaymentEvent } from "./payments";
import { audit } from "./audit";

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;

export const taxFor = (pricePaise: bigint, gstRateBps: number) => (pricePaise * BigInt(gstRateBps) + 5000n) / 10000n;

/** Indian financial year label, April to March. */
export function financialYear(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

async function nextInvoiceNumber(tx: Tx) {
  const fy = financialYear();
  const c = await tx.invoiceCounter.upsert({ where: { fy }, create: { fy, last: 1 }, update: { last: { increment: 1 } } });
  return `PBS/${fy}/${String(c.last).padStart(6, "0")}`;
}

/** featuredUntil is always derived from the live (unrevoked) entitlements, so refunds and expiry stay consistent. */
export async function recomputeFeatured(tx: Tx | PrismaClient, listingId: string) {
  const top = await tx.entitlement.findFirst({ where: { listingId, kind: "FEATURED_LISTING", revokedAt: null }, orderBy: { endsAt: "desc" } });
  await tx.listing.update({ where: { id: listingId }, data: { featuredUntil: top?.endsAt ?? null } });
}

export async function isFlagOn(db: PrismaClient, key: string | null) {
  if (!key) return true;
  return !!(await db.featureFlag.findUnique({ where: { key } }))?.enabled;
}

export type ProcessResult = { status: "duplicate" | "ignored" | "fulfilled" | "already_paid" | "failed" | "refunded" | "amount_mismatch" };

/**
 * Applies a verified provider event exactly once. The WebhookEvent unique key makes retries and
 * duplicate deliveries no-ops; order status changes use guarded updates so concurrent events cannot double-fulfil.
 * Paid benefits are only ever activated here, never from a browser redirect.
 */
export async function processPaymentEvent(ctx: AppContext, ev: PaymentEvent): Promise<ProcessResult> {
  const { db } = ctx;
  const provider = ctx.payments.name;
  try {
    await db.webhookEvent.create({ data: { provider, eventId: ev.eventId, type: ev.type, payload: (ev.raw ?? {}) as Prisma.InputJsonValue } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: "duplicate" };
    throw e;
  }
  const markDone = () => db.webhookEvent.update({ where: { provider_eventId: { provider, eventId: ev.eventId } }, data: { processedAt: new Date() } });

  const order = await db.order.findUnique({ where: { providerRef: ev.providerRef }, include: { plan: true } });
  if (!order) { await markDone(); return { status: "ignored" }; }

  let result: ProcessResult = { status: "ignored" };
  if (ev.type === "payment.captured") {
    if (BigInt(ev.amountPaise) !== order.totalPaise) {
      await audit(db, null, "payment.amount_mismatch", "Order", order.id, { expected: Number(order.totalPaise), got: ev.amountPaise });
      await markDone();
      return { status: "amount_mismatch" };
    }
    result = await db.$transaction(async (tx) => {
      await tx.payment.createMany({ data: [{ orderId: order.id, provider, providerRef: ev.paymentRef, status: "captured", amountPaise: BigInt(ev.amountPaise), raw: (ev.raw ?? {}) as Prisma.InputJsonValue }], skipDuplicates: true });
      const invoiceNumber = await nextInvoiceNumber(tx);
      const upd = await tx.order.updateMany({ where: { id: order.id, status: { in: ["CREATED", "PENDING", "FAILED"] } }, data: { status: "PAID", invoiceNumber } });
      if (upd.count === 0) throw new AlreadyPaid();
      const now = new Date();
      let startsAt = now;
      if (order.plan.kind === "FEATURED_LISTING" && order.listingId) {
        const listing = await tx.listing.findUniqueOrThrow({ where: { id: order.listingId } });
        if (listing.featuredUntil && listing.featuredUntil > now) startsAt = listing.featuredUntil; // stack placements
      }
      const endsAt = new Date(startsAt.getTime() + order.plan.durationDays * DAY);
      await tx.entitlement.create({ data: { userId: order.userId, orderId: order.id, kind: order.plan.kind, listingId: order.listingId, startsAt, endsAt } });
      if (order.plan.kind === "FEATURED_LISTING" && order.listingId) await recomputeFeatured(tx, order.listingId);
      await audit(tx, order.userId, "order.paid", "Order", order.id, { plan: order.plan.code, invoiceNumber });
      return { status: "fulfilled" as const };
    }).catch((e) => { if (e instanceof AlreadyPaid) return { status: "already_paid" as const }; throw e; });
  } else if (ev.type === "payment.failed") {
    await db.payment.createMany({ data: [{ orderId: order.id, provider, providerRef: ev.paymentRef, status: "failed", amountPaise: BigInt(ev.amountPaise), raw: (ev.raw ?? {}) as Prisma.InputJsonValue }], skipDuplicates: true });
    const upd = await db.order.updateMany({ where: { id: order.id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED" } });
    if (upd.count) await audit(db, order.userId, "order.failed", "Order", order.id, {});
    result = { status: "failed" };
  } else if (ev.type === "refund.processed") {
    result = await db.$transaction(async (tx) => {
      const upd = await tx.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "REFUNDED" } });
      if (!upd.count) return { status: "ignored" as const };
      await tx.payment.createMany({ data: [{ orderId: order.id, provider, providerRef: ev.paymentRef, status: "refunded", amountPaise: BigInt(ev.amountPaise), raw: (ev.raw ?? {}) as Prisma.InputJsonValue }], skipDuplicates: true });
      await tx.entitlement.updateMany({ where: { orderId: order.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (order.listingId) await recomputeFeatured(tx, order.listingId);
      await audit(tx, null, "order.refunded", "Order", order.id, {});
      return { status: "refunded" as const };
    });
  }
  await markDone();
  return result;
}

class AlreadyPaid extends Error {}
