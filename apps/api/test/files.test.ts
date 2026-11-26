import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { setupApp, completeRental } from "./helpers";

let t: Awaited<ReturnType<typeof setupApp>>;

function multipart(field: string, filename: string, type: string, data: Buffer) {
  const boundary = "----pbs" + Math.random().toString(16).slice(2);
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, data, tail]), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

beforeAll(async () => { t = await setupApp(); });
afterAll(async () => { await t.app.close(); await t.db.$disconnect(); });

describe("uploads and private documents (#5)", () => {
  it("strips metadata from photos, rejects non-images, and keeps documents private", async () => {
    const geo = await t.seedGeo();
    const owner = await t.login(), other = await t.login(), mod = await t.login({ roles: ["MODERATOR"] });
    const id = (await t.app.inject({ method: "POST", url: "/v1/listings", headers: owner.auth, payload: completeRental(geo.city.id, geo.adyar.id) })).json().id;

    const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#0E7C66" } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: "secret-gps-test" } } }).toBuffer();
    const up = multipart("file", "a.jpg", "image/jpeg", jpeg);
    const r = await t.app.inject({ method: "POST", url: `/v1/listings/${id}/media`, headers: { ...owner.auth, ...up.headers }, payload: up.payload });
    expect(r.statusCode).toBe(201);
    const img = await t.app.inject({ method: "GET", url: r.json().url, headers: owner.auth });
    expect(img.statusCode).toBe(200);
    expect((await sharp(img.rawPayload).metadata()).exif).toBeUndefined();
    // draft photos are not public
    expect((await t.app.inject({ method: "GET", url: r.json().url })).statusCode).toBe(404);

    const fake = multipart("file", "x.jpg", "image/jpeg", Buffer.from("not an image"));
    expect((await t.app.inject({ method: "POST", url: `/v1/listings/${id}/media`, headers: { ...owner.auth, ...fake.headers }, payload: fake.payload })).statusCode).toBe(415);

    const doc = multipart("file", "patta.pdf", "application/pdf", Buffer.from("%PDF-1.4 demo"));
    const d = await t.app.inject({ method: "POST", url: `/v1/listings/${id}/documents`, headers: { ...owner.auth, ...doc.headers }, payload: doc.payload });
    expect(d.statusCode).toBe(201);
    const docId = d.json().id;
    expect((await t.app.inject({ method: "GET", url: `/v1/documents/${docId}/url`, headers: other.auth })).statusCode).toBe(404);
    const signed = (await t.app.inject({ method: "GET", url: `/v1/documents/${docId}/url`, headers: mod.auth })).json();
    const file = await t.app.inject({ method: "GET", url: signed.url });
    expect(file.statusCode).toBe(200);
    expect(file.body).toContain("%PDF");
    expect((await t.app.inject({ method: "GET", url: "/v1/files/private?token=forged.token" })).statusCode).toBe(403);
    expect((await t.app.inject({ method: "GET", url: `/v1/listings/${id}` , headers: owner.auth })).body).not.toContain("private/documents");
  });
});
