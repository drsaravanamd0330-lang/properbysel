import { formatINR, formatINRShort, CATEGORY_LABEL, ADVERTISER_LABEL, AREA_UNIT_LABEL, type PropertyCategory, type AdvertiserType, type AreaUnit } from "@pbs/domain";
import type { PublicListing } from "@pbs/api-client";

export function headlinePrice(l: Pick<PublicListing, "transaction" | "pricePaise" | "rentPaise" | "leasePaise">): string {
  if (l.transaction === "SALE" && l.pricePaise) return formatINRShort(l.pricePaise);
  if (l.transaction === "RENT" && l.rentPaise) return `${formatINR(l.rentPaise)}/month`;
  if (l.transaction === "LEASE" && l.leasePaise) return `${formatINRShort(l.leasePaise)} lease`;
  return "Price on request";
}
export const categoryLabel = (c: string | null) => (c ? CATEGORY_LABEL[c as PropertyCategory] ?? c : "Property");
export const advertiserLabel = (a: string | null) => (a ? ADVERTISER_LABEL[a as AdvertiserType] : "Advertiser");
export const txLabel = (t: string | null) => (t === "SALE" ? "For sale" : t === "RENT" ? "For rent" : t === "LEASE" ? "For lease" : "");
export function areaLabel(l: Pick<PublicListing, "areaValue" | "areaUnit" | "areaSqft">): string | null {
  if (!l.areaValue || !l.areaUnit) return null;
  const main = `${l.areaValue.toLocaleString("en-IN")} ${AREA_UNIT_LABEL[l.areaUnit as AreaUnit]}`;
  return l.areaUnit !== "SQFT" && l.areaSqft ? `${main} (${Math.round(l.areaSqft).toLocaleString("en-IN")} sq ft)` : main;
}
export const statusLabel = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const AMENITY_LABEL = (a: string) => a.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
