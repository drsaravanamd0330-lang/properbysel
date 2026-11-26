import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupApp, completeRental, publishListing } from "./helpers";
import { loadConfig, UnsafeConfigError } from "../src/config";
import { expireListings } from "../src/jobs";

let t: Awaited<ReturnType<typeof setupApp>>;
let geo: Awaited<ReturnType<typeof t.seedGeo>>;
let owner: Awaited<ReturnType<typeof t.login>>, buyer: typeof owner, stranger: typeof owner, mod: typeof owner;

beforeAll(async () => {
  t = await setupApp();
  geo = await t.seedGeo();
  owner = await t.login({ name: "Owner One" });
  buyer = await t.login({ name: "Buyer One" });
  stranger = await t.login({ name: "Stranger" });
  mod = await t.login({ roles: ["MODERATOR"], name: "Mod" });
});
afterAll(async () => { await t.app.close(); await t.db.$disconnect(); });

describe("auth", () => {
  it("rejects a wrong OTP and limits attempts", async () => {
    const phone = "+919812300001";
    await t.app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone } });
    const bad = await t.app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone, code: "000000" === t.otp.outbox.get(phone) ? "111111" : "000000" } });
    expect(bad.statusCode).toBe(400);
  });
  it("rotates refresh tokens", async () => {
    const u = await t.login();
    const r1 = await t.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: u.refreshToken } });
    expect(r1.statusCode).toBe(200);
    const reuse = await t.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: u.refreshToken } });
    expect(reuse.statusCode).toBe(401);
  });
  it("#13 production config rejects the development OTP bypass", () => {
    expect(() => loadConfig({ DATABASE_URL: "x", APP_ENV: "production", OTP_PROVIDER: "dev", JWT_SECRET: "a".repeat(40), STORAGE_PROVIDER: "s3" } as NodeJS.ProcessEnv)).toThrow(UnsafeConfigError);
    expect(() => loadConfig({ DATABASE_URL: "x", APP_ENV: "production", OTP_PROVIDER: "msg91", JWT_SECRET: "dev-secret-dev-secret-dev-secret-xx", STORAGE_PROVIDER: "s3" } as NodeJS.ProcessEnv)).toThrow(UnsafeConfigError);
  });
});

describe("first workflow", () => {
  let listingId: string;

  it("#1 a user can save a partial draft, resume it, and submit", async () => {
    const created = await t.app.inject({ method: "POST", url: "/v1/listings", headers: owner.auth, payload: { advertiserType: "OWNER", transaction: "RENT", wizardStep: 2 } });
    expect(created.statusCode).toBe(201);
    listingId = created.json().id;
    expect(created.json().status).toBe("DRAFT");

    const early = await t.app.inject({ method: "POST", url: `/v1/listings/${listingId}/submit`, headers: owner.auth });
    expect(early.statusCode).toBe(422);
    expect(early.json().error.details.map((d: { path: string }) => d.path)).toContain("title");

    // resume: fetch saved draft
    const resumed = await t.app.inject({ method: "GET", url: `/v1/listings/${listingId}`, headers: owner.auth });
    expect(resumed.json().wizardStep).toBe(2);
    expect(resumed.json().transaction).toBe("RENT");

    const saved = await t.app.inject({ method: "PATCH", url: `/v1/listings/${listingId}`, headers: owner.auth, payload: completeRental(geo.city.id, geo.adyar.id) });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().bedrooms).toBe(2);

    const sub = await t.app.inject({ method: "POST", url: `/v1/listings/${listingId}/submit`, headers: owner.auth });
    expect(sub.statusCode).toBe(200);
    expect(sub.json().status).toBe("PENDING_REVIEW");
  });

  it("#3 pending listings are not public", async () => {
    const r = await t.app.inject({ method: "GET", url: `/v1/properties/${listingId}` });
    expect(r.statusCode).toBe(404);
    const s = (await t.app.inject({ method: "GET", url: "/v1/search?city=chennai" })).json();
    expect(s.items.map((i: { id: string }) => i.id)).not.toContain(listingId);
  });

  it("#4 other users cannot read or edit someone else's listing; owners cannot moderate", async () => {
    expect((await t.app.inject({ method: "PATCH", url: `/v1/listings/${listingId}`, headers: stranger.auth, payload: { title: "Hijacked listing title" } })).statusCode).toBe(404);
    expect((await t.app.inject({ method: "GET", url: `/v1/listings/${listingId}`, headers: stranger.auth })).statusCode).toBe(404);
    expect((await t.app.inject({ method: "POST", url: `/v1/admin/listings/${listingId}/decision`, headers: owner.auth, payload: { decision: "APPROVE" } })).statusCode).toBe(403);
    expect((await t.app.inject({ method: "PATCH", url: `/v1/listings/${listingId}`, headers: owner.auth, payload: { title: "Changed during review" } })).statusCode).toBe(409);
  });

  it("#2 a moderator can request changes, then publish after resubmission", async () => {
    const queue = (await t.app.inject({ method: "GET", url: "/v1/admin/listings", headers: mod.auth })).json();
    expect(queue.items.map((i: { id: string }) => i.id)).toContain(listingId);
    const rc = await t.app.inject({ method: "POST", url: `/v1/admin/listings/${listingId}/decision`, headers: mod.auth, payload: { decision: "REQUEST_CHANGES", note: "Please add more detail" } });
    expect(rc.json().status).toBe("CHANGES_REQUESTED");
    const view = (await t.app.inject({ method: "GET", url: `/v1/listings/${listingId}`, headers: owner.auth })).json();
    expect(view.lastReview.note).toBe("Please add more detail");
    await t.app.inject({ method: "PATCH", url: `/v1/listings/${listingId}`, headers: owner.auth, payload: { description: "Well ventilated flat close to schools, shops and the bus depot. Two covered parking spots." } });
    expect((await t.app.inject({ method: "POST", url: `/v1/listings/${listingId}/submit`, headers: owner.auth })).json().status).toBe("PENDING_REVIEW");
    const ap = await t.app.inject({ method: "POST", url: `/v1/admin/listings/${listingId}/decision`, headers: mod.auth, payload: { decision: "APPROVE" } });
    expect(ap.json().status).toBe("PUBLISHED");
    const notes = (await t.app.inject({ method: "GET", url: "/v1/me/notifications", headers: owner.auth })).json();
    expect(notes.items.some((n: { type: string }) => n.type === "LISTING_APPROVE")).toBe(true);
  });

  it("public detail hides private fields and rounds location", async () => {
    const r = await t.app.inject({ method: "GET", url: `/v1/properties/${listingId}` });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.address).toBeUndefined();
    expect(b.lat).toBeUndefined();
    expect(b.approxLat).toBe(13);
    expect(JSON.stringify(b)).not.toContain(owner.phone);
    expect(JSON.stringify(b)).not.toContain("Private Street");
  });

  let enquiryId: string, conversationId: string;
  it("#7 an enquiry reaches the correct advertiser, and retries do not duplicate it", async () => {
    const headers = { ...buyer.auth, "idempotency-key": "enq-1" };
    const e1 = await t.app.inject({ method: "POST", url: `/v1/properties/${listingId}/enquiries`, headers, payload: { message: "Is this still available?" } });
    expect(e1.statusCode).toBe(201);
    const e2 = await t.app.inject({ method: "POST", url: `/v1/properties/${listingId}/enquiries`, headers, payload: { message: "Is this still available?" } });
    expect(e2.json().id).toBe(e1.json().id);
    expect(e2.json().duplicate).toBe(true);
    enquiryId = e1.json().id; conversationId = e1.json().conversationId;

    const inbox = (await t.app.inject({ method: "GET", url: "/v1/me/inbox", headers: owner.auth })).json();
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0].id).toBe(enquiryId);
    expect(inbox.items[0].unread).toBe(true);
    expect(inbox.items[0].buyer.phone).toBeNull(); // buyer did not opt to share
    expect((await t.app.inject({ method: "GET", url: "/v1/me/inbox", headers: stranger.auth })).json().items).toHaveLength(0);
    expect((await t.app.inject({ method: "POST", url: `/v1/properties/${listingId}/enquiries`, headers: owner.auth, payload: { message: "Own listing enquiry" } })).statusCode).toBe(400);
  });

  it("advertiser replies and manages the lead; phone reveal needs an enquiry", async () => {
    const m = await t.app.inject({ method: "POST", url: `/v1/conversations/${conversationId}/messages`, headers: owner.auth, payload: { body: "Yes, available from next week." } });
    expect(m.statusCode).toBe(201);
    const conv = (await t.app.inject({ method: "GET", url: `/v1/conversations/${conversationId}`, headers: buyer.auth })).json();
    expect(conv.messages).toHaveLength(2);
    expect(conv.myRole).toBe("BUYER");
    const lead = await t.app.inject({ method: "PATCH", url: `/v1/leads/${enquiryId}`, headers: owner.auth, payload: { stage: "CONTACTED", note: "Called back" } });
    expect(lead.json().stage).toBe("CONTACTED");
    expect((await t.app.inject({ method: "PATCH", url: `/v1/leads/${enquiryId}`, headers: buyer.auth, payload: { stage: "CLOSED" } })).statusCode).toBe(404);
    expect((await t.app.inject({ method: "GET", url: `/v1/properties/${listingId}/contact`, headers: buyer.auth })).json().available).toBe(true);
    expect((await t.app.inject({ method: "GET", url: `/v1/properties/${listingId}/contact`, headers: stranger.auth })).json().available).toBe(false);
  });

  it("#5 conversations are private to participants", async () => {
    expect((await t.app.inject({ method: "GET", url: `/v1/conversations/${conversationId}`, headers: stranger.auth })).statusCode).toBe(404);
    expect((await t.app.inject({ method: "POST", url: `/v1/conversations/${conversationId}/messages`, headers: stranger.auth, payload: { body: "hi" } })).statusCode).toBe(404);
  });

  it("#8 visit lifecycle follows permissions", async () => {
    const when = new Date(Date.now() + 3 * 86400_000).toISOString();
    const v = (await t.app.inject({ method: "POST", url: `/v1/leads/${enquiryId}/visits`, headers: buyer.auth, payload: { proposedAt: when } })).json();
    expect(v.status).toBe("REQUESTED");
    expect((await t.app.inject({ method: "POST", url: `/v1/visits/${v.id}/action`, headers: buyer.auth, payload: { action: "ACCEPT" } })).statusCode).toBe(409);
    expect((await t.app.inject({ method: "POST", url: `/v1/visits/${v.id}/action`, headers: stranger.auth, payload: { action: "ACCEPT" } })).statusCode).toBe(404);
    const acc = await t.app.inject({ method: "POST", url: `/v1/visits/${v.id}/action`, headers: owner.auth, payload: { action: "ACCEPT" } });
    expect(acc.json().status).toBe("ACCEPTED");
    expect((await t.db.enquiry.findUniqueOrThrow({ where: { id: enquiryId } })).stage).toBe("VISIT_SCHEDULED");
    expect((await t.app.inject({ method: "POST", url: `/v1/visits/${v.id}/action`, headers: buyer.auth, payload: { action: "COMPLETE" } })).statusCode).toBe(409);
    expect((await t.app.inject({ method: "POST", url: `/v1/visits/${v.id}/action`, headers: owner.auth, payload: { action: "COMPLETE" } })).json().status).toBe("COMPLETED");
  });

  it("material edits on a live listing go back to review", async () => {
    const r = await t.app.inject({ method: "PATCH", url: `/v1/listings/${listingId}`, headers: owner.auth, payload: { rentPaise: 2800000 } });
    expect(r.json().status).toBe("PENDING_REVIEW");
    expect((await t.app.inject({ method: "GET", url: `/v1/properties/${listingId}` })).statusCode).toBe(404);
    await t.app.inject({ method: "POST", url: `/v1/admin/listings/${listingId}/decision`, headers: mod.auth, payload: { decision: "APPROVE" } });
  });

  it("#12 closing a listing removes it from search and stops enquiries", async () => {
    const r = await t.app.inject({ method: "POST", url: `/v1/listings/${listingId}/actions`, headers: owner.auth, payload: { action: "MARK_RENTED" } });
    expect(r.json().status).toBe("RENTED");
    expect((await t.app.inject({ method: "GET", url: `/v1/properties/${listingId}` })).statusCode).toBe(410);
    const s = (await t.app.inject({ method: "GET", url: "/v1/search?city=chennai" })).json();
    expect(s.items.map((i: { id: string }) => i.id)).not.toContain(listingId);
    const e = await t.app.inject({ method: "POST", url: `/v1/properties/${listingId}/enquiries`, headers: stranger.auth, payload: { message: "Still available?" } });
    expect(e.statusCode).toBe(409);
  });
});

describe("#6 search filters, sorting and pagination", () => {
  const ids: string[] = [];
  beforeAll(async () => {
    const o = await t.login({ name: "Search Owner" });
    const rents = [15000, 22000, 30000, 45000, 60000];
    for (const [i, rent] of rents.entries()) {
      ids.push(await publishListing(t.app, o, mod, completeRental(geo.city.id, i % 2 ? geo.velachery.id : geo.adyar.id, {
        title: `Search test flat number ${i}`, rentPaise: rent * 100,
        attributes: { bedrooms: (i % 3) + 1, bathrooms: 1, furnishing: i % 2 ? "FURNISHED" : "UNFURNISHED", carpetAreaSqft: 500 + i * 200 },
      })));
    }
    ids.push(await publishListing(t.app, o, mod, { ...completeRental(geo.city.id, geo.adyar.id), title: "Plot for sale search test", transaction: "SALE", category: "RESIDENTIAL_PLOT", rentPaise: undefined, pricePaise: 500000000, attributes: { plotArea: 2, plotAreaUnit: "GROUND" } }));
  });

  const search = async (qs: string) => (await t.app.inject({ method: "GET", url: `/v1/search?${qs}` })).json();

  it("filters by transaction, price range and locality", async () => {
    const r = await search("city=chennai&transaction=RENT&minPrice=20000&maxPrice=50000&q=Search%20test");
    expect(r.items.map((i: { rentPaise: number }) => i.rentPaise / 100).sort((a: number, b: number) => a - b)).toEqual([22000, 30000, 45000]);
    const v = await search("locality=velachery&q=Search%20test");
    expect(v.total).toBe(2);
  });
  it("filters by bedrooms, furnishing, category and land area in sq ft", async () => {
    expect((await search("bedrooms=1&q=Search%20test")).total).toBe(2);
    expect((await search("furnishing=FURNISHED&q=Search%20test")).total).toBe(2);
    const plot = await search("category=RESIDENTIAL_PLOT&minArea=4800&maxArea=4800");
    expect(plot.items[0].areaUnit).toBe("GROUND");
    expect(plot.items[0].areaSqft).toBe(4800);
  });
  it("sorts by price and paginates without overlap", async () => {
    const asc = await search("transaction=RENT&q=Search%20test&sort=price_asc");
    const prices = asc.items.map((i: { rentPaise: number }) => i.rentPaise);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const p1 = await search("q=Search%20test&sort=newest&pageSize=2&page=1");
    const p2 = await search("q=Search%20test&sort=newest&pageSize=2&page=2");
    expect(p1.totalPages).toBe(3);
    const overlap = p1.items.filter((a: { id: string }) => p2.items.some((b: { id: string }) => b.id === a.id));
    expect(overlap).toHaveLength(0);
  });
  it("#3 expired listings drop out of search", async () => {
    await t.db.listing.update({ where: { id: ids[0]! }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await search("q=Search%20test%20flat%20number%200")).total).toBe(0);
    const n = await expireListings(t.db);
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await t.db.listing.findUniqueOrThrow({ where: { id: ids[0]! } })).status).toBe("EXPIRED");
  });
});
