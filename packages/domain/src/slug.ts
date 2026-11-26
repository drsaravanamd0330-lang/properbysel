export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 80);
}

/** Public, stable listing path: /property/<slug>-<shortId> */
export function listingPath(title: string, id: string): string {
  return `/property/${slugify(title)}-${id}`;
}

export function idFromListingSlug(slug: string): string | null {
  const m = /([a-z0-9]{20,})$/i.exec(slug);
  return m ? m[1]! : null;
}

/** Round coordinates to ~1.1 km for public display. */
export function approximateCoord(n: number): number {
  return Math.round(n * 100) / 100;
}
