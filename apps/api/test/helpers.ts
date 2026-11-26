import { PrismaClient } from "@prisma/client";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { loadConfig } from "../src/config";
import { DevOtpSender } from "../src/lib/otp";
import { LocalStorage } from "../src/lib/storage";
import "../src/db"; // BigInt JSON

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://pbs:pbs@localhost:5432/properbysel_test";

export async function setupApp() {
  const db = new PrismaClient({ datasourceUrl: TEST_DB });
  const cfg = loadConfig({ DATABASE_URL: TEST_DB, JWT_SECRET: "test-secret-0123456789abcdef", APP_ENV: "test" } as NodeJS.ProcessEnv);
  const otp = new DevOtpSender(() => undefined);
  const storage = new LocalStorage(mkdtempSync(join(tmpdir(), "pbs-")));
  const { app } = await buildApp({ cfg, db, otp, storage, logger: false });
  await app.ready();

  let phoneSeq = 0;
  async function login(opts: { roles?: string[]; name?: string } = {}) {
    const phone = `+9198${String(Date.now()).slice(-5)}${String(phoneSeq++).padStart(3, "0")}`;
    await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone } });
    const code = otp.outbox.get(phone)!;
    const r = await app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone, code, name: opts.name ?? "Test User" } });
    let body = r.json();
    if (opts.roles?.length) {
      for (const role of opts.roles) await db.userRole.create({ data: { userId: body.user.id, role: role as never } });
      // re-login to get a token carrying the new roles
      await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone } });
      body = (await app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone, code: otp.outbox.get(phone)! } })).json();
    }
    const auth = { authorization: `Bearer ${body.accessToken}` };
    return { id: body.user.id as string, phone, auth, refreshToken: body.refreshToken as string };
  }

  async function seedGeo() {
    const city = await db.city.upsert({ where: { slug: "chennai" }, create: { name: "Chennai", slug: "chennai", state: "Tamil Nadu" }, update: {} });
    const adyar = await db.locality.upsert({ where: { cityId_slug: { cityId: city.id, slug: "adyar" } }, create: { cityId: city.id, name: "Adyar", slug: "adyar", postcodes: ["600020"], lat: 13.0012, lng: 80.2565 }, update: {} });
    const velachery = await db.locality.upsert({ where: { cityId_slug: { cityId: city.id, slug: "velachery" } }, create: { cityId: city.id, name: "Velachery", slug: "velachery", postcodes: ["600042"], lat: 12.98, lng: 80.218 }, update: {} });
    return { city, adyar, velachery };
  }

  return { app, db, otp, login, seedGeo };
}

export const completeRental = (cityId: string, localityId: string, extra: Record<string, unknown> = {}) => ({
  advertiserType: "OWNER", transaction: "RENT", category: "APARTMENT",
  title: "Spacious 2 BHK near Adyar depot", description: "Well ventilated flat close to schools, shops and the bus depot.",
  cityId, localityId, address: "12 Private Street", lat: 13.0034567, lng: 80.2567891, rentPaise: 2500000, depositPaise: 10000000,
  attributes: { bedrooms: 2, bathrooms: 2, furnishing: "SEMI_FURNISHED", carpetAreaSqft: 950 }, contactConsent: true, showPhone: true,
  ...extra,
});

export async function publishListing(app: FastifyInstance, owner: { auth: Record<string, string> }, mod: { auth: Record<string, string> }, payload: Record<string, unknown>) {
  const id = (await app.inject({ method: "POST", url: "/v1/listings", headers: owner.auth, payload })).json().id as string;
  const s = await app.inject({ method: "POST", url: `/v1/listings/${id}/submit`, headers: owner.auth });
  if (s.statusCode !== 200) throw new Error(`submit failed: ${s.body}`);
  const d = await app.inject({ method: "POST", url: `/v1/admin/listings/${id}/decision`, headers: mod.auth, payload: { decision: "APPROVE" } });
  if (d.statusCode !== 200) throw new Error(`approve failed: ${d.body}`);
  return id;
}
