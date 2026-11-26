import { PrismaClient, type Prisma } from "@prisma/client";
import sharp from "sharp";
import { slugify, CATEGORY_GROUP, toSqft, LISTING_TTL_DAYS, type PropertyCategory, type AreaUnit } from "@pbs/domain";
import { CITIES, LISTINGS } from "./seed-data";
import { LocalStorage } from "../src/lib/storage";

const db = new PrismaClient();
if (process.env.APP_ENV === "production") { console.error("Refusing to seed demo data in production."); process.exit(1); }
const storage = new LocalStorage(process.env.LOCAL_STORAGE_DIR ?? "./storage");

const PALETTE = ["#0B2545", "#13315C", "#0E7C66", "#1B998B", "#8DA9C4", "#134074"];

async function demoPhoto(label: string, i: number): Promise<Buffer> {
  const c = PALETTE[i % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="${c}"/>
  <path d="M300 560 L600 320 L900 560 Z" fill="#F7F3EA" opacity=".9"/><rect x="390" y="540" width="420" height="160" fill="#F7F3EA" opacity=".9"/>
  <rect x="560" y="590" width="80" height="110" fill="${c}"/><text x="600" y="120" font-family="Arial" font-size="44" fill="#F7F3EA" text-anchor="middle">DEMO PHOTO</text>
  <text x="600" y="180" font-family="Arial" font-size="30" fill="#F7F3EA" text-anchor="middle" opacity=".8">${label.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 50)}</text></svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 70 }).toBuffer();
}

async function main() {
  for (const c of CITIES) {
    const city = await db.city.upsert({ where: { slug: c.slug }, create: { name: c.name, slug: c.slug, state: c.state, lat: c.lat, lng: c.lng }, update: {} });
    for (const [name, pin, lat, lng] of c.localities) {
      await db.locality.upsert({ where: { cityId_slug: { cityId: city.id, slug: slugify(name) } }, create: { cityId: city.id, name, slug: slugify(name), postcodes: [pin], lat, lng }, update: {} });
    }
  }

  const users = [
    { phone: "+919000000001", name: "Demo Admin", roles: ["USER", "ADMIN", "MODERATOR"] },
    { phone: "+919000000002", name: "Demo Moderator", roles: ["USER", "MODERATOR"] },
    { phone: "+919000000003", name: "Priya Demo-Owner", roles: ["USER", "ADVERTISER"] },
    { phone: "+919000000004", name: "Karthik Demo-Agent", roles: ["USER", "ADVERTISER", "AGENT"] },
    { phone: "+919000000005", name: "Arun Demo-Buyer", roles: ["USER"] },
    { phone: "+919000000006", name: "Lakshmi Demo-Builder", roles: ["USER", "ADVERTISER", "BUILDER"] },
  ] as const;
  const byName: Record<string, string> = {};
  for (const u of users) {
    const row = await db.user.upsert({ where: { phone: u.phone }, create: { phone: u.phone, name: u.name, isDemo: true, phoneVerifiedAt: new Date() }, update: {} });
    for (const r of u.roles) await db.userRole.upsert({ where: { userId_role: { userId: row.id, role: r } }, create: { userId: row.id, role: r }, update: {} });
    byName[u.name] = row.id;
  }
  const ownerFor = { OWNER: byName["Priya Demo-Owner"]!, AGENT: byName["Karthik Demo-Agent"]!, BUILDER: byName["Lakshmi Demo-Builder"]! };
  const moderator = byName["Demo Moderator"]!;

  const existing = await db.listing.count({ where: { isDemo: true } });
  if (existing > 0) { console.log(`Demo listings already present (${existing}); skipping listings.`); return; }

  const now = Date.now();
  for (const [i, s] of LISTINGS.entries()) {
    const city = await db.city.findUniqueOrThrow({ where: { slug: s.city ?? "chennai" } });
    const loc = await db.locality.findUniqueOrThrow({ where: { cityId_slug: { cityId: city.id, slug: slugify(s.locality) } } });
    const cat = s.category as PropertyCategory;
    const group = CATEGORY_GROUP[cat];
    const a = s.attributes as Record<string, number | string>;
    const paise = BigInt(s.rupees) * 100n;
    const areaValue = group === "LAND" ? Number(a.plotArea) : Number(a.carpetAreaSqft ?? a.builtUpAreaSqft ?? a.superBuiltUpAreaSqft);
    const areaUnit = (group === "LAND" ? a.plotAreaUnit : "SQFT") as AreaUnit;
    const publishedAt = new Date(now - (i + 1) * 36 * 3600_000);
    const jitter = () => (Math.random() - 0.5) * 0.01;
    const data: Prisma.ListingUncheckedCreateInput = {
      ownerId: ownerFor[s.advertiserType], status: "PUBLISHED", isDemo: true,
      advertiserType: s.advertiserType, transaction: s.transaction, category: cat, title: s.title, description: s.description,
      cityId: city.id, localityId: loc.id, address: `Demo address ${i + 1}, ${s.locality}`, postcode: loc.postcodes[0], landmark: s.landmark,
      lat: Number(loc.lat) + jitter(), lng: Number(loc.lng) + jitter(),
      attributes: s.attributes as Prisma.InputJsonValue, amenities: s.amenities ?? [],
      bedrooms: group === "RESIDENTIAL" ? Number(a.bedrooms) : null,
      furnishing: group === "RESIDENTIAL" ? (a.furnishing as "FURNISHED") : null,
      areaValue, areaUnit, areaSqft: toSqft(areaValue, areaUnit),
      pricePaise: s.transaction === "SALE" ? paise : null, rentPaise: s.transaction === "RENT" ? paise : null, leasePaise: s.transaction === "LEASE" ? paise : null,
      depositPaise: s.deposit ? BigInt(s.deposit) * 100n : null, maintenancePaise: s.maintenance ? BigInt(s.maintenance) * 100n : null,
      sortPricePaise: paise, negotiable: i % 2 === 0,
      brokerageDisclosure: s.advertiserType === "AGENT" ? "Brokerage: one month's rent or 1% of sale value, payable to the agent" : null,
      availableFrom: new Date(now + 7 * 86400_000), showPhone: i % 3 === 0, contactConsent: true, investmentSuitable: !!s.investment, wizardStep: 8,
      submittedAt: publishedAt, publishedAt, expiresAt: new Date(publishedAt.getTime() + LISTING_TTL_DAYS * 86400_000),
      featuredUntil: s.featured ? new Date(now + 30 * 86400_000) : null,
    };
    const l = await db.listing.create({ data });
    for (let p = 0; p < 3; p++) {
      const buf = await demoPhoto(s.title, i + p);
      const key = `public/listings/${l.id}/demo-${p}.webp`;
      await storage.put(key, buf);
      await db.media.create({ data: { listingId: l.id, storageKey: key, mimeType: "image/webp", bytes: buf.length, width: 1200, height: 800, position: p, caption: "Demo photo" } });
    }
    await db.moderationReview.create({ data: { listingId: l.id, moderatorId: moderator, decision: "APPROVE", note: "Demo seed", fromStatus: "PENDING_REVIEW", toStatus: "PUBLISHED" } });
    if (i % 2 === 0) await db.verification.create({ data: { kind: "PHONE_CONFIRMED", listingId: l.id, reviewedBy: moderator } });
  }
  console.log(`Seeded ${LISTINGS.length} demo listings, ${users.length} demo users.`);
}

main().finally(() => db.$disconnect());
