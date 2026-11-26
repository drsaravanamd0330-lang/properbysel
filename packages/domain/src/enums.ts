export const PROPERTY_CATEGORIES = [
  "APARTMENT",
  "INDEPENDENT_HOUSE",
  "VILLA",
  "RESIDENTIAL_PLOT",
  "AGRICULTURAL_LAND",
  "COMMERCIAL_OFFICE",
  "SHOP",
  "WAREHOUSE",
  "INDUSTRIAL",
] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export type CategoryGroup = "RESIDENTIAL" | "LAND" | "COMMERCIAL";
export const CATEGORY_GROUP: Record<PropertyCategory, CategoryGroup> = {
  APARTMENT: "RESIDENTIAL",
  INDEPENDENT_HOUSE: "RESIDENTIAL",
  VILLA: "RESIDENTIAL",
  RESIDENTIAL_PLOT: "LAND",
  AGRICULTURAL_LAND: "LAND",
  COMMERCIAL_OFFICE: "COMMERCIAL",
  SHOP: "COMMERCIAL",
  WAREHOUSE: "COMMERCIAL",
  INDUSTRIAL: "COMMERCIAL",
};

export const CATEGORY_LABEL: Record<PropertyCategory, string> = {
  APARTMENT: "Apartment / Flat",
  INDEPENDENT_HOUSE: "Independent house",
  VILLA: "Villa",
  RESIDENTIAL_PLOT: "Residential plot",
  AGRICULTURAL_LAND: "Agricultural land / Farmland",
  COMMERCIAL_OFFICE: "Office space",
  SHOP: "Shop / Showroom",
  WAREHOUSE: "Warehouse / Godown",
  INDUSTRIAL: "Industrial land / Building",
};

export const TRANSACTION_TYPES = ["SALE", "RENT", "LEASE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const ADVERTISER_TYPES = ["OWNER", "AGENT", "BUILDER"] as const;
export type AdvertiserType = (typeof ADVERTISER_TYPES)[number];
export const ADVERTISER_LABEL: Record<AdvertiserType, string> = {
  OWNER: "Owner",
  AGENT: "Agent / Broker",
  BUILDER: "Builder / Developer",
};

export const ROLES = ["USER", "ADVERTISER", "AGENT", "BUILDER", "MODERATOR", "SUPPORT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: readonly Role[] = ["MODERATOR", "SUPPORT", "ADMIN"];

export const FURNISHING = ["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"] as const;
export type Furnishing = (typeof FURNISHING)[number];

export const LEAD_STAGES = ["NEW", "CONTACTED", "VISIT_SCHEDULED", "NEGOTIATING", "CLOSED", "LOST"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const AMENITIES = [
  "LIFT", "POWER_BACKUP", "SECURITY", "CCTV", "GYM", "SWIMMING_POOL", "CLUBHOUSE",
  "PLAY_AREA", "GATED_COMMUNITY", "RAINWATER_HARVESTING", "BOREWELL", "METRO_WATER",
  "CAR_PARKING", "VISITOR_PARKING", "INTERCOM", "GAS_PIPELINE",
] as const;
export type Amenity = (typeof AMENITIES)[number];
