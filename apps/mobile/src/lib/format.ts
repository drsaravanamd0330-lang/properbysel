import { formatINR, formatINRShort, CATEGORY_LABEL, ADVERTISER_LABEL, AREA_UNIT_LABEL, type PropertyCategory, type AdvertiserType, type AreaUnit } from "@pbs/domain";
import type { PublicListing } from "@pbs/api-client";

export function headlinePrice(l: Pick<PublicListing, "transaction" | "pricePaise" | "rentPaise" | "leasePaise">) {
  if (l.transaction === "SALE" && l.pricePaise) return formatINRShort(l.pricePaise);
  if (l.transaction === "RENT" && l.rentPaise) return `${formatINR(l.rentPaise)}/month`;
  if (l.transaction === "LEASE" && l.leasePaise) return `${formatINRShort(l.leasePaise)} lease`;
  return "Price on request";
}
export const categoryLabel = (c: string | null) => (c ? CATEGORY_LABEL[c as PropertyCategory] ?? c : "Property");
export const advertiserLabel = (a: string | null) => (a ? ADVERTISER_LABEL[a as AdvertiserType] : "Advertiser");
export const statusLabel = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const areaLabel = (l: Pick<PublicListing, "areaValue" | "areaUnit">) => (l.areaValue && l.areaUnit ? `${l.areaValue.toLocaleString("en-IN")} ${AREA_UNIT_LABEL[l.areaUnit as AreaUnit]}` : null);
export const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export { formatINR };
export const inrExact = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
