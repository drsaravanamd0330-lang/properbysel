import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupApp, completeRental, publishListing } from "./helpers";
import { loadConfig, UnsafeConfigError } from "../src/config";
import { LAUNCH_PLANS } from "../src/lib/plans";
import { SandboxProvider } from "../src/lib/payments";

let t: Awaited<ReturnType<typeof setupApp>>;
let owner: Awaited<ReturnType<typeof t.login>>, other: typeof owner, mod: typeof owner, admin: typeof owner;
let listingId: string;
let sandbox: SandboxProvider;

beforeAll(async () => {
  t = await setupApp();
  const geo = await t.seedGeo();
  for (const p of LAUNCH_PLANS) await t.db.plan.upsert({ where: { code: p.code }, create: { ...p }, update: {} });
  owner = await t.login({ name: "Paying Owner" });
  other = await t.login({ name: "Other" });
  mod = await t.login({ roles: ["MODERATOR"] });
  admin = await t.login({ roles: ["ADMIN"] });
  listingId = await publishListing(t.app, owner, mod, completeRental(geo.city.id, geo.adyar.id, { title: "Featured candidate 2 BHK in Adyar" }));
  sandbox = new SandboxProvider("sandbox:test-secret-0123456789abcdef", "http://localhost:4000");
});
afterAll(async () => { await t.app.close(); await t.db.$disconnect(); });

async function createOrder(planCode = "FEATURED_7D", who = owner, lid: string | undefined = listingId) {
  const r = await t.app.inject({ method: "POST", url: "/v1/orders", headers: who.auth, payload: { planCode, listingId: lid } });
  return r;
}

function webhook(ev: Record<string, unknown>, signature?: string) {
  const payload = JSON.stringify(ev);
  return t.app.inject({ method: "POST", url: "/v1/payments/webhook/sandbox", headers: { "content-type": "application/json", "x-sandbox-signature": signature ?? sandbox.sign(payload) }, payload });
}

describe("plans and orders", () => {
  it("lists plans with GST, hiding manual services until their flag is on", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/plans" });
    const items = r.json().items as { code: string; pricePaise: number; taxPaise: number; totalPaise: number }[];
    expect(items.find((p) => p.code === "PHOTOSHOOT")).toBeUndefined();
    const f7 = items.find((p) => p.code === "FEATURED_7D")!;
    expect(f7).toMatchObject({ pricePaise: 29900, taxPaise: 5382, totalPaise: 35282 });
    await t.app.inject({ method: "PUT", url: "/v1/admin/flags/manual_photoshoot", headers: admin.auth, payload: { enabled: true } });
    const r2 = await t.app.inject({ method: "GET", url: "/v1/plans" });
    expect((r2.json().items as { code: string }[]).some((p) => p.code === "PHOTOSHOOT")).toBe(true);
    await t.app.inject({ method: "PUT", url: "/v1/admin/flags/manual_photoshoot", headers: admin.auth, payload: { enabled: false } });
  });

  it("only lets the owner feature their own live listing", async () => {
    expect((await createOrder("FEATURED_7D", other)).statusCode).toBe(404);
    expect((await t.app.inject({ method: "POST", url: "/v1/orders", headers: owner.auth, payload: { planCode: "FEATURED_7D" } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: "POST", url: "/v1/orders", payload: { planCode: "FEATURED_7D", listingId } })).statusCode).toBe(401);
  });

  it("rejects webhooks with a bad signature", async () => {
    const r = await webhook({ eventId: "x", type: "payment.captured", providerRef: "nope", paymentRef: "p", amountPaise: 1 }, "deadbeef");
    expect(r.statusCode).toBe(400);
  });

  it("does not activate anything on order creation or on the browser return URL", async () => {
    const r = await createOrder();
    expect(r.statusCode).toBe(201);
    const { order, checkoutUrl } = r.json();
    expect(order.status).toBe("PENDING");
    expect(checkoutUrl).toContain("/v1/payments/sandbox/checkout/");
    // a user visiting the "success" page of the web app proves nothing; listing stays unfeatured
    const l = await t.db.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(l.featuredUntil).toBeNull();
  });
});

describe("#9 duplicate webhooks fulfil exactly once", () => {
  it("applies a captured payment once even when delivered three times", async () => {
    const { order } = (await createOrder()).json();
    const o = await t.db.order.findUniqueOrThrow({ where: { id: order.id } });
    const ev = { eventId: `evt_dup_${o.id}`, type: "payment.captured", providerRef: o.providerRef, paymentRef: `pay_${o.id}`, amountPaise: Number(o.totalPaise) };
    const results = await Promise.all([webhook(ev), webhook(ev), webhook(ev)]);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(results.map((r) => r.json().status).filter((s) => s === "fulfilled")).toHaveLength(1);
    // a second, distinct capture event for the same order must not double-fulfil either
    const again = await webhook({ ...ev, eventId: `evt_dup2_${o.id}`, paymentRef: `pay2_${o.id}` });
    expect(again.json().status).toBe("already_paid");

    expect(await t.db.entitlement.count({ where: { orderId: o.id } })).toBe(1);
    const paid = await t.db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.invoiceNumber).toMatch(/^PBS\/\d{4}-\d{2}\/\d{6}$/);
    const l = await t.db.listing.findUniqueOrThrow({ where: { id: listingId } });
    const days = (l.featuredUntil!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    const pub = await t.app.inject({ method: "GET", url: `/v1/search?city=chennai&transaction=RENT` });
    expect(pub.json().items[0]).toMatchObject({ id: listingId, isSponsored: true });
    const rec = await t.app.inject({ method: "GET", url: `/v1/orders/${o.id}/receipt`, headers: owner.auth });
    expect(rec.statusCode).toBe(200);
    expect(rec.body).toContain("Payment receipt");
    expect(rec.body).toContain("not a tax invoice");
    expect((await t.app.inject({ method: "GET", url: `/v1/orders/${o.id}/receipt`, headers: other.auth })).statusCode).toBe(404);
  });

  it("stacks a second placement after the first instead of overlapping", async () => {
    const before = (await t.db.listing.findUniqueOrThrow({ where: { id: listingId } })).featuredUntil!;
    const { order } = (await createOrder()).json();
    const o = await t.db.order.findUniqueOrThrow({ where: { id: order.id } });
    await webhook({ eventId: `evt_stack_${o.id}`, type: "payment.captured", providerRef: o.providerRef, paymentRef: `pay_${o.id}`, amountPaise: Number(o.totalPaise) });
    const after = (await t.db.listing.findUniqueOrThrow({ where: { id: listingId } })).featuredUntil!;
    expect(Math.round((after.getTime() - before.getTime()) / 86_400_000)).toBe(7);
  });

  it("refuses to fulfil when the captured amount does not match", async () => {
    const { order } = (await createOrder()).json();
    const o = await t.db.order.findUniqueOrThrow({ where: { id: order.id } });
    const r = await webhook({ eventId: `evt_amt_${o.id}`, type: "payment.captured", providerRef: o.providerRef, paymentRef: `pay_${o.id}`, amountPaise: 100 });
    expect(r.json().status).toBe("amount_mismatch");
    expect((await t.db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PENDING");
  });
});

describe("#10 failed payments grant nothing", () => {
  it("marks the order failed via the sandbox checkout and leaves the listing unchanged", async () => {
    const before = (await t.db.listing.findUniqueOrThrow({ where: { id: listingId } })).featuredUntil;
    const { order, checkoutUrl } = (await createOrder("FEATURED_30D")).json();
    const path = new URL(checkoutUrl).pathname;
    const page = await t.app.inject({ method: "GET", url: path });
    expect(page.body).toContain("SANDBOX CHECKOUT");
    const r = await t.app.inject({ method: "POST", url: `${path}/fail?return=${encodeURIComponent("https://evil.example/steal")}`, headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "r=1" });
    expect(r.statusCode).toBe(303);
    expect(r.headers.location).toBe(`http://localhost:3000/dashboard/orders/${order.id}`); // open redirect refused
    expect((await t.db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("FAILED");
    expect(await t.db.entitlement.count({ where: { orderId: order.id } })).toBe(0);
    expect((await t.db.listing.findUniqueOrThrow({ where: { id: listingId } })).featuredUntil).toEqual(before);
    expect((await t.app.inject({ method: "GET", url: `/v1/orders/${order.id}/receipt`, headers: owner.auth })).statusCode).toBe(409);

    // a retry on the same order can still succeed
    const ok = await t.app.inject({ method: "POST", url: `${path}/succeed`, headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "r=1" });
    expect(ok.statusCode).toBe(303);
    expect((await t.db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });
});

describe("refunds", () => {
  it("lets only an admin refund, and revokes the placement", async () => {
    const { order } = (await createOrder()).json();
    const o = await t.db.order.findUniqueOrThrow({ where: { id: order.id } });
    await webhook({ eventId: `evt_rf_${o.id}`, type: "payment.captured", providerRef: o.providerRef, paymentRef: `pay_${o.id}`, amountPaise: Number(o.totalPaise) });
    const withIt = (await t.db.listing.findUniqueOrThrow({ where: { id: listingId } })).featuredUntil!;
    expect((await t.app.inject({ method: "POST", url: `/v1/admin/orders/${o.id}/refund`, headers: owner.auth })).statusCode).toBe(403);
    const r = await t.app.inject({ method: "POST", url: `/v1/admin/orders/${o.id}/refund`, headers: admin.auth });
    expect(r.json().status).toBe("refunded");
    const without = (await t.db.listing.findUniqueOrThrow({ where: { id: listingId } })).featuredUntil!;
    expect(without.getTime()).toBeLessThan(withIt.getTime());
    expect((await t.db.entitlement.findUniqueOrThrow({ where: { orderId: o.id } })).revokedAt).not.toBeNull();
    const list = await t.app.inject({ method: "GET", url: "/v1/admin/orders?status=REFUNDED", headers: admin.auth });
    expect(list.json().items.some((x: { id: string }) => x.id === o.id)).toBe(true);
  });
});

describe("#11 expired placements stop showing", () => {
  it("drops a listing from sponsored slots once featuredUntil passes", async () => {
    await t.db.listing.update({ where: { id: listingId }, data: { featuredUntil: new Date(Date.now() - 60_000) } });
    const pub = await t.app.inject({ method: "GET", url: `/v1/search?city=chennai&transaction=RENT` });
    const item = pub.json().items.find((x: { id: string }) => x.id === listingId);
    expect(item?.isSponsored).toBe(false);
  });
});

describe("production guard", () => {
  it("refuses the sandbox payment provider in production", () => {
    expect(() => loadConfig({ APP_ENV: "production", DATABASE_URL: "postgresql://x/y", JWT_SECRET: "x".repeat(48), OTP_PROVIDER: "msg91", STORAGE_PROVIDER: "s3", PAYMENT_PROVIDER: "sandbox" } as NodeJS.ProcessEnv)).toThrow(UnsafeConfigError);
  });
});
