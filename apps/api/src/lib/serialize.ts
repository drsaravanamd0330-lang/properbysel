import type { Listing, Media, City, Locality, User, Verification } from "@prisma/client";
import { approximateCoord, listingPath } from "@pbs/domain";

type FullListing = Listing & {
  media?: Media[]; city?: City | null; locality?: Locality | null;
  owner?: Pick<User, "id" | "name"> | null; verifications?: Verification[];
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const mediaUrl = (m: Media) => `/v1/media/${m.id}`;

const VERIFICATION_LABEL: Record<string, string> = {
  PHONE_CONFIRMED: "Phone confirmed",
  IDENTITY_REVIEWED: "Identity reviewed",
  PROPERTY_VISITED: "Property visit completed",
  DOCUMENTS_REVIEWED: "Documents reviewed (not a title check)",
};

/** Public view: no exact location, address, contact details or moderation data. */
export function publicListing(l: FullListing, now = new Date()) {
  return {
    id: l.id,
    path: listingPath(l.title ?? "property", l.id),
    title: l.title,
    description: l.description,
    status: l.status,
    advertiserType: l.advertiserType,
    advertiserName: l.owner?.name ? l.owner.name.split(" ")[0] : null,
    transaction: l.transaction,
    category: l.category,
    city: l.city ? { name: l.city.name, slug: l.city.slug } : null,
    locality: l.locality ? { name: l.locality.name, slug: l.locality.slug } : null,
    postcode: l.postcode,
    landmark: l.landmark,
    approxLat: l.lat !== null ? approximateCoord(Number(l.lat)) : null,
    approxLng: l.lng !== null ? approximateCoord(Number(l.lng)) : null,
    attributes: l.attributes,
    amenities: l.amenities,
    bedrooms: l.bedrooms,
    furnishing: l.furnishing,
    areaSqft: num(l.areaSqft),
    areaValue: num(l.areaValue),
    areaUnit: l.areaUnit,
    pricePaise: num(l.pricePaise),
    rentPaise: num(l.rentPaise),
    leasePaise: num(l.leasePaise),
    depositPaise: num(l.depositPaise),
    maintenancePaise: num(l.maintenancePaise),
    negotiable: l.negotiable,
    brokerageDisclosure: l.brokerageDisclosure,
    availableFrom: l.availableFrom,
    investmentSuitable: l.investmentSuitable,
    canShowPhone: l.showPhone,
    isSponsored: !!l.featuredUntil && l.featuredUntil > now,
    isDemo: l.isDemo,
    verifications: (l.verifications ?? []).map((v) => VERIFICATION_LABEL[v.kind] ?? v.kind),
    media: (l.media ?? []).sort((a, b) => a.position - b.position).map((m) => ({ id: m.id, url: mediaUrl(m), kind: m.kind, width: m.width, height: m.height })),
    publishedAt: l.publishedAt,
    updatedAt: l.updatedAt,
  };
}

/** Owner / staff view: includes private fields but still never private document storage keys. */
export function ownerListing(l: FullListing) {
  return {
    ...publicListing(l),
    address: l.address,
    lat: num(l.lat),
    lng: num(l.lng),
    cityId: l.cityId,
    localityId: l.localityId,
    showPhone: l.showPhone,
    contactConsent: l.contactConsent,
    wizardStep: l.wizardStep,
    submittedAt: l.submittedAt,
    expiresAt: l.expiresAt,
    closedAt: l.closedAt,
    ownerId: l.ownerId,
    createdAt: l.createdAt,
  };
}
