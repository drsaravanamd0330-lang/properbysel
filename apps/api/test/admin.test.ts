import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupApp, completeRental, publishListing } from "./helpers";
import { sendSavedSearchAlerts } from "../src/jobs";

let t: Awaited<ReturnType<typeof setupApp>>;
let geo: Awaited<ReturnType<typeof t.seedGeo>>;
let owner: Awaited<ReturnType<typeof t.login>>, buyer: typeof owner, mod: typeof owner, admin: typeof owner, support: typeof owner;

beforeAll(async () => {
  t = await setupApp();
  geo = await t.seedGeo();
  owner = await t.login({ name: "Report Target Owner" });
  buyer = await t.login({ name: "Alert Buyer" });
  mod = await t.login({ roles: ["MODERATOR"] });
  admin = await t.login({ roles: ["ADMIN"], name: "Admin" });
  support = await t.login({ roles: ["SUPPORT"] });
});
afterAll(async () => { await t.app.close(); await t.db.$disconnect(); });

describe("reports queue", () => {
  it("moderator takes a reported listing down; owner must resubmit for review", async () => {
    const id = await publishListing(t.app, owner, mod, completeRental(geo.city.id, geo.adyar.id, { title: "Reported flat with wrong rent shown" }));
    const rep = await t.app.inject({ method: "POST", url: `/v1/properties/${id}/report`, headers: buyer.auth, payload: { reason: "WRONG_INFO", details: "Owner asked for double the rent" } });
    expect(rep.statusCode).toBeLessThan(300);
    expect((await t.app.inject({ method: "GET", url: "/v1/admin/reports", headers: owner.auth })).statusCode).toBe(403);
    const q = await t.app.inject({ method: "GET", url: "/v1/admin/reports", headers: support.auth });
    const item = q.json().items.find((r: { listing: { id: string } | null }) => r.listing?.id === id);
    expect(item).toBeTruthy();
    // support can view but not act
    expect((await t.app.inject({ method: "POST", url: `/v1/admin/reports/${item.id}/action`, headers: support.auth, payload: { action: "DISMISS" } })).statusCode).toBe(403);
    expect((await t.app.inject({ method: "POST", url: `/v1/admin/reports/${item.id}/action`, headers: mod.auth, payload: { action: "TAKE_DOWN" } })).statusCode).toBe(400);
    const act = await t.app.inject({ method: "POST", url: `/v1/admin/reports/${item.id}/action`, headers: mod.auth, payload: { action: "TAKE_DOWN", note: "Show the actual monthly rent" } });
    expect(act.json().status).toBe("ACTIONED");
    const l = await t.db.listing.findUniqueOrThrow({ where: { id } });
    expect(l.status).toBe("CHANGES_REQUESTED");
    expect((await t.app.inject({ method: "GET", url: `/v1/properties/${id}` })).statusCode).not.toBe(200);
    // owner cannot simply resume it
    expect((await t.app.inject({ method: "POST", url: `/v1/listings/${id}/actions`, headers: owner.auth, payload: { action: "RESUME" } })).statusCode).toBe(409);
    expect((await t.app.inject({ method: "POST", url: `/v1/listings/${id}/submit`, headers: owner.auth })).json().status).toBe("PENDING_REVIEW");
    expect(await t.db.notification.count({ where: { userId: owner.id, type: "LISTING_TAKEN_DOWN" } })).toBe(1);
    expect((await t.app.inject({ method: "POST", url: `/v1/admin/reports/${item.id}/action`, headers: mod.auth, payload: { action: "DISMISS" } })).statusCode).toBe(409);
  });
});

describe("users and roles", () => {
  it("admin grants a role, which revokes sessions; support sees masked phones only", async () => {
    const target = await t.login({ name: "Future Moderator" });
    const asSupport = await t.app.inject({ method: "GET", url: `/v1/admin/users?q=Future`, headers: support.auth });
    expect(asSupport.json().items[0].phone).toContain("••");
    const asAdmin = await t.app.inject({ method: "GET", url: `/v1/admin/users?q=Future`, headers: admin.auth });
    expect(asAdmin.json().items[0].phone).toBe(target.phone);
    expect((await t.app.inject({ method: "PUT", url: `/v1/admin/users/${target.id}/roles`, headers: mod.auth, payload: { roles: ["MODERATOR"] } })).statusCode).toBe(403);
    const r = await t.app.inject({ method: "PUT", url: `/v1/admin/users/${target.id}/roles`, headers: admin.auth, payload: { roles: ["USER", "MODERATOR"] } });
    expect(r.json().roles).toContain("MODERATOR");
    const refresh = await t.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: target.refreshToken } });
    expect(refresh.statusCode).toBe(401);
    expect((await t.app.inject({ method: "PUT", url: `/v1/admin/users/${admin.id}/roles`, headers: admin.auth, payload: { roles: ["USER"] } })).statusCode).toBe(409);
  });

  it("blocking stops login and records the reason in the audit log", async () => {
    const bad = await t.login({ name: "Scammer" });
    const b = await t.app.inject({ method: "POST", url: `/v1/admin/users/${bad.id}/block`, headers: admin.auth, payload: { blocked: true, reason: "Asked for token advance before visit" } });
    expect(b.json().blocked).toBe(true);
    await t.app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: bad.phone } });
    const v = await t.app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone: bad.phone, code: t.otp.outbox.get(bad.phone) } });
    expect(v.statusCode).toBe(403);
    const log = await t.app.inject({ method: "GET", url: `/v1/admin/audit?entityType=User&entityId=${bad.id}`, headers: admin.auth });
    expect(log.json().items[0]).toMatchObject({ action: "USER_BLOCKED", meta: { reason: "Asked for token advance before visit" } });
    expect((await t.app.inject({ method: "GET", url: "/v1/admin/audit", headers: mod.auth })).statusCode).toBe(403);
  });
});

describe("metrics", () => {
  it("returns launch KPIs for admins only, excluding demo data", async () => {
    expect((await t.app.inject({ method: "GET", url: "/v1/admin/metrics", headers: mod.auth })).statusCode).toBe(403);
    const m = (await t.app.inject({ method: "GET", url: "/v1/admin/metrics", headers: admin.auth })).json();
    expect(m.excludesDemoData).toBe(true);
    expect(m.users.total).toBeGreaterThan(0);
    expect(m.listings.live).toBeGreaterThanOrEqual(0);
    expect(m.moderation).toHaveProperty("medianReviewHours30d");
    expect(m.revenue).toHaveProperty("grossPaise30d");
  });
});

describe("saved searches and compare", () => {
  it("saves a search, alerts once on a new match, and never re-alerts for the same listing", async () => {
    const r = await t.app.inject({ method: "POST", url: "/v1/me/saved-searches", headers: buyer.auth, payload: { name: "Velachery rentals", query: { city: "chennai", locality: "velachery", transaction: "RENT", page: 3, junk: "x" } } });
    expect(r.statusCode).toBe(201);
    expect(r.json().query).toEqual({ city: "chennai", locality: "velachery", transaction: "RENT" });
    const id = r.json().id;
    expect((await t.app.inject({ method: "DELETE", url: `/v1/me/saved-searches/${id}`, headers: owner.auth })).statusCode).toBe(404);

    await publishListing(t.app, owner, mod, completeRental(geo.city.id, geo.velachery.id, { title: "Fresh Velachery 2 BHK for alerts" }));
    await t.db.savedSearch.update({ where: { id }, data: { lastAlertedAt: new Date(Date.now() - 60_000) } });
    await sendSavedSearchAlerts(t.db);
    const n = await t.db.notification.findMany({ where: { userId: buyer.id, type: "SAVED_SEARCH_MATCH" } });
    expect(n).toHaveLength(1);
    expect(n[0]!.link).toContain("locality=velachery");
    await sendSavedSearchAlerts(t.db);
    expect(await t.db.notification.count({ where: { userId: buyer.id, type: "SAVED_SEARCH_MATCH" } })).toBe(1);
  });

  it("compares up to four public listings and reports hidden ones as unavailable", async () => {
    const a = await publishListing(t.app, owner, mod, completeRental(geo.city.id, geo.adyar.id, { title: "Compare me A in Adyar" }));
    const draft = (await t.app.inject({ method: "POST", url: "/v1/listings", headers: owner.auth, payload: { title: "Secret draft" } })).json().id;
    const r = await t.app.inject({ method: "GET", url: `/v1/compare?ids=${a},${draft}` });
    expect(r.json().items.map((x: { id: string }) => x.id)).toEqual([a]);
    expect(r.json().unavailable).toEqual([draft]);
    expect(JSON.stringify(r.json())).not.toContain("12 Private Street");
  });
});
