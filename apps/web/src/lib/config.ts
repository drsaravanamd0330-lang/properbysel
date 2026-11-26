export const API_URL = process.env.API_INTERNAL_URL ?? process.env.PUBLIC_API_URL ?? "http://localhost:4000";
export const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
export const BRAND = {
  name: "ProperBySel",
  tagline: "RENT | BUY | SELL",
  secondary: "LAND • HOMES • PROPERTIES",
  positioning: "India's Smart Property Marketplace",
  ownership: "A Product of AAROVIN SOFTWARE SOLUTIONS",
} as const;
