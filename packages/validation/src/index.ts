import { z } from "zod";
import {
  PROPERTY_CATEGORIES, TRANSACTION_TYPES, ADVERTISER_TYPES, FURNISHING, AMENITIES, AREA_UNITS,
  CATEGORY_GROUP, LEAD_STAGES, type PropertyCategory,
} from "@pbs/domain";

// ---------- Auth ----------
/** Indian mobile number, normalized to +91XXXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .transform((s) => (s.startsWith("+91") ? s : s.startsWith("91") && s.length === 12 ? `+${s}` : `+91${s.replace(/^0/, "")}`))
  .refine((s) => /^\+91[6-9]\d{9}$/.test(s), "Enter a valid 10-digit Indian mobile number");

export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  name: z.string().trim().min(2).max(80).optional(),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().optional().or(z.literal("")),
});

// ---------- Listing ----------
const money = z.coerce.number().int().nonnegative().max(1_000_000_000_000_00); // paise, up to ₹1 lakh crore
const area = z.coerce.number().positive().max(1e9);

export const residentialAttrs = z.object({
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
  balconies: z.coerce.number().int().min(0).max(20).optional(),
  floor: z.coerce.number().int().min(-2).max(200).optional(),
  totalFloors: z.coerce.number().int().min(1).max(200).optional(),
  furnishing: z.enum(FURNISHING),
  parking: z.enum(["NONE", "BIKE", "CAR", "BOTH"]).optional(),
  ageYears: z.coerce.number().int().min(0).max(150).optional(),
  carpetAreaSqft: area.optional(),
  builtUpAreaSqft: area.optional(),
  superBuiltUpAreaSqft: area.optional(),
}).refine((a) => a.carpetAreaSqft || a.builtUpAreaSqft || a.superBuiltUpAreaSqft, { message: "Enter at least one area (carpet, built-up or super built-up)", path: ["carpetAreaSqft"] })
  .refine((a) => a.floor === undefined || a.totalFloors === undefined || a.floor <= a.totalFloors, { message: "Floor cannot exceed total floors", path: ["floor"] });

export const landAttrs = z.object({
  plotArea: area,
  plotAreaUnit: z.enum(AREA_UNITS),
  frontageFt: z.coerce.number().positive().max(10000).optional(),
  roadAccess: z.enum(["NONE", "MUD", "TAR", "CONCRETE"]).optional(),
  roadWidthFt: z.coerce.number().positive().max(500).optional(),
  permittedUseClaim: z.string().trim().max(200).optional(),
  water: z.string().trim().max(120).optional(),
  electricity: z.string().trim().max(120).optional(),
});

export const commercialAttrs = z.object({
  suitableFor: z.string().trim().max(200).optional(),
  builtUpAreaSqft: area,
  floor: z.coerce.number().int().min(-2).max(200).optional(),
  powerKva: z.coerce.number().positive().max(100000).optional(),
  loadingAccess: z.boolean().optional(),
  ceilingHeightFt: z.coerce.number().positive().max(200).optional(),
  parkingSlots: z.coerce.number().int().min(0).max(10000).optional(),
  washrooms: z.coerce.number().int().min(0).max(1000).optional(),
});

export function attrsSchemaFor(category: PropertyCategory) {
  const g = CATEGORY_GROUP[category];
  return g === "RESIDENTIAL" ? residentialAttrs : g === "LAND" ? landAttrs : commercialAttrs;
}

/** Draft save: everything optional so the wizard can autosave partial progress. */
export const listingDraftSchema = z.object({
  advertiserType: z.enum(ADVERTISER_TYPES).optional(),
  transaction: z.enum(TRANSACTION_TYPES).optional(),
  category: z.enum(PROPERTY_CATEGORIES).optional(),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  cityId: z.string().optional(),
  localityId: z.string().optional(),
  address: z.string().trim().max(300).optional(),
  postcode: z.string().regex(/^\d{6}$/, "Enter a 6-digit PIN code").optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(6).max(38).optional(),
  lng: z.coerce.number().min(68).max(98).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).optional(),
  pricePaise: money.optional(),
  rentPaise: money.optional(),
  leasePaise: money.optional(),
  depositPaise: money.optional(),
  maintenancePaise: money.optional(),
  negotiable: z.boolean().optional(),
  brokerageDisclosure: z.string().trim().max(200).optional(),
  availableFrom: z.coerce.date().optional(),
  showPhone: z.boolean().optional(),
  contactConsent: z.boolean().optional(),
  investmentSuitable: z.boolean().optional(),
  wizardStep: z.coerce.number().int().min(1).max(8).optional(),
});
export type ListingDraftInput = z.infer<typeof listingDraftSchema>;

export interface SubmitIssue { path: string; message: string }

/** Full validation run on submit; returns field issues instead of throwing. */
export function validateForSubmit(d: ListingDraftInput & { mediaCount?: number }): SubmitIssue[] {
  const issues: SubmitIssue[] = [];
  const need = (cond: unknown, path: string, message: string) => { if (!cond) issues.push({ path, message }); };
  need(d.advertiserType, "advertiserType", "Choose who is posting");
  need(d.transaction, "transaction", "Choose sale, rent or lease");
  need(d.category, "category", "Choose a property type");
  need(d.title && d.title.length >= 10, "title", "Title must be at least 10 characters");
  need(d.description && d.description.length >= 30, "description", "Description must be at least 30 characters");
  need(d.cityId, "cityId", "Choose a city");
  need(d.localityId, "localityId", "Choose a locality");
  need(d.contactConsent === true, "contactConsent", "Confirm you agree to be contacted about this listing");
  if (d.transaction === "SALE") need(d.pricePaise && d.pricePaise > 0, "pricePaise", "Enter the sale price");
  if (d.transaction === "RENT") need(d.rentPaise && d.rentPaise > 0, "rentPaise", "Enter the monthly rent");
  if (d.transaction === "LEASE") need(d.leasePaise && d.leasePaise > 0, "leasePaise", "Enter the lease amount");
  if (d.advertiserType === "AGENT") need(d.brokerageDisclosure, "brokerageDisclosure", "Agents must state the brokerage terms");
  if (d.category) {
    const r = attrsSchemaFor(d.category).safeParse(d.attributes ?? {});
    if (!r.success) for (const i of r.error.issues) issues.push({ path: `attributes.${i.path.join(".")}`, message: i.message });
  }
  return issues;
}

// ---------- Search ----------
export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  city: z.string().optional(),
  locality: z.string().optional(),
  postcode: z.string().regex(/^\d{6}$/).optional(),
  transaction: z.enum(TRANSACTION_TYPES).optional(),
  category: z.union([z.enum(PROPERTY_CATEGORIES), z.array(z.enum(PROPERTY_CATEGORIES))]).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(), // rupees
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  minArea: z.coerce.number().nonnegative().optional(), // sq ft
  maxArea: z.coerce.number().nonnegative().optional(),
  bedrooms: z.union([z.coerce.number().int(), z.array(z.coerce.number().int())]).optional(),
  furnishing: z.enum(FURNISHING).optional(),
  advertiserType: z.enum(ADVERTISER_TYPES).optional(),
  amenities: z.union([z.enum(AMENITIES), z.array(z.enum(AMENITIES))]).optional(),
  bbox: z.string().regex(/^-?[\d.]+,-?[\d.]+,-?[\d.]+,-?[\d.]+$/).optional(), // minLng,minLat,maxLng,maxLat
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc"]).default("relevance"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ---------- Moderation ----------
export const moderationDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), note: z.string().max(1000).optional() }),
  z.object({ decision: z.literal("REQUEST_CHANGES"), note: z.string().trim().min(5).max(1000) }),
  z.object({ decision: z.literal("REJECT"), note: z.string().trim().min(5).max(1000) }),
]);

// ---------- Enquiries & messages ----------
export const enquirySchema = z.object({
  message: z.string().trim().min(5, "Write a short message").max(1000),
  shareMyPhone: z.boolean().default(false),
});
export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const leadUpdateSchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  note: z.string().trim().max(1000).optional(),
});
export const visitRequestSchema = z.object({
  proposedAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), "Choose a future time"),
  note: z.string().trim().max(500).optional(),
});
export const visitActionSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE", "RESCHEDULE", "CANCEL", "COMPLETE"]),
  proposedAt: z.coerce.date().optional(),
});
export const reportSchema = z.object({
  reason: z.enum(["FRAUD", "WRONG_INFO", "ALREADY_SOLD", "DUPLICATE", "OFFENSIVE", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
});
