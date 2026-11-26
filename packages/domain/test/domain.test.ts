import { describe, it, expect } from "vitest";
import { nextStatus, TransitionError, rupeesToPaise, formatINR, formatINRShort, toSqft, convertArea, approximateCoord, idFromListingSlug, listingPath } from "../src";

describe("listing state machine", () => {
  it("owner submits a draft", () => expect(nextStatus("DRAFT", "SUBMIT", "OWNER")).toBe("PENDING_REVIEW"));
  it("moderator approves", () => expect(nextStatus("PENDING_REVIEW", "APPROVE", "MODERATOR")).toBe("PUBLISHED"));
  it("owner cannot approve own listing", () => expect(() => nextStatus("PENDING_REVIEW", "APPROVE", "OWNER")).toThrow(TransitionError));
  it("cannot publish a draft directly", () => expect(() => nextStatus("DRAFT", "APPROVE", "MODERATOR")).toThrow(TransitionError));
  it("material edit sends live listing back to review", () => expect(nextStatus("PUBLISHED", "EDIT_MATERIAL", "OWNER")).toBe("PENDING_REVIEW"));
  it("resubmit after changes requested", () => expect(nextStatus("CHANGES_REQUESTED", "SUBMIT", "OWNER")).toBe("PENDING_REVIEW"));
});

describe("money", () => {
  it("stores paise exactly", () => expect(rupeesToPaise(1234.56)).toBe(123456n));
  it("formats Indian grouping", () => expect(formatINR(1_25_00_000_00n)).toBe("₹1,25,00,000"));
  it("short format", () => {
    expect(formatINRShort(1_25_00_000_00n)).toBe("₹1.25 Cr");
    expect(formatINRShort(45_00_000_00n)).toBe("₹45 L");
  });
});

describe("area", () => {
  it("ground is 2400 sq ft", () => expect(toSqft(1, "GROUND")).toBe(2400));
  it("cent to sqft", () => expect(toSqft(10, "CENT")).toBe(4356));
  it("acre to cents", () => expect(convertArea(1, "ACRE", "CENT")).toBe(100));
});

describe("slugs and privacy", () => {
  it("round trips id", () => {
    const p = listingPath("2 BHK in Adyar", "clx0abcdefghijklmnopqrst");
    expect(idFromListingSlug(p.split("/").pop()!)).toBe("clx0abcdefghijklmnopqrst");
  });
  it("approximates coordinates", () => expect(approximateCoord(13.006789)).toBe(13.01));
});
