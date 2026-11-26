import { describe, it, expect } from "vitest";
import { phoneSchema, validateForSubmit, searchQuerySchema } from "../src";

describe("phone", () => {
  it("normalizes 10 digits", () => expect(phoneSchema.parse("98765 43210")).toBe("+919876543210"));
  it("rejects landline-like", () => expect(phoneSchema.safeParse("1234567890").success).toBe(false));
});

describe("submit validation", () => {
  const base = {
    advertiserType: "OWNER" as const, transaction: "RENT" as const, category: "APARTMENT" as const,
    title: "Spacious 2 BHK near Adyar", description: "Well ventilated flat close to schools and the bus depot.",
    cityId: "c", localityId: "l", contactConsent: true, rentPaise: 2500000,
    attributes: { bedrooms: 2, bathrooms: 2, furnishing: "SEMI_FURNISHED", carpetAreaSqft: 950 },
  };
  it("accepts a complete residential listing", () => expect(validateForSubmit(base)).toEqual([]));
  it("requires rent for rentals", () => expect(validateForSubmit({ ...base, rentPaise: undefined }).map((i) => i.path)).toContain("rentPaise"));
  it("requires an area for residential", () => expect(validateForSubmit({ ...base, attributes: { bedrooms: 2, bathrooms: 1, furnishing: "FURNISHED" } }).some((i) => i.path.startsWith("attributes"))).toBe(true));
  it("agents must disclose brokerage", () => expect(validateForSubmit({ ...base, advertiserType: "AGENT" }).map((i) => i.path)).toContain("brokerageDisclosure"));
  it("land needs plot area and unit", () => expect(validateForSubmit({ ...base, category: "RESIDENTIAL_PLOT", transaction: "SALE", pricePaise: 1, attributes: {} }).length).toBeGreaterThan(0));
});

describe("search query", () => {
  it("defaults", () => expect(searchQuerySchema.parse({})).toMatchObject({ sort: "relevance", page: 1, pageSize: 20 }));
});
