import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_LABEL, PROPERTY_CATEGORIES, AMENITIES, ADVERTISER_LABEL, ADVERTISER_TYPES } from "@pbs/domain";
import { SaveSearch } from "@/components/SaveSearch";
import { ApiError, type SearchResult, type City } from "@pbs/api-client";
import { publicApi, freshApi } from "@/lib/server-api";
import { ListingCard } from "@/components/ListingCard";
import { MapView } from "@/components/MapView";
import { AMENITY_LABEL, categoryLabel } from "@/lib/format";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const tx = one(sp.transaction) === "SALE" ? "for sale" : one(sp.transaction) === "RENT" ? "for rent" : "";
  const cat = one(sp.category) ? categoryLabel(one(sp.category)!) : "Properties";
  const city = one(sp.city) ? one(sp.city)!.replace(/^\w/, (c) => c.toUpperCase()) : "India";
  // Only the simple city/transaction/category pages are indexable; deeper filter combinations are noindex.
  const simple = Object.keys(sp).every((k) => ["city", "transaction", "category"].includes(k));
  return { title: `${cat} ${tx} in ${city}`.replace(/\s+/g, " "), robots: simple ? undefined : { index: false, follow: true }, alternates: simple ? { canonical: `/search?${new URLSearchParams(Object.entries(sp).map(([k, v]) => [k, one(v) ?? ""]))}` } : undefined };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sp)) if (k !== "view" && v !== undefined && v !== "") query[k] = v;
  let res: SearchResult | null = null, error: string | null = null, cities: City[] = [], localities: { name: string; slug: string }[] = [];
  try {
    [res, { items: cities }] = await Promise.all([freshApi.search(query), publicApi.geo.cities()]);
    if (one(sp.city)) localities = (await publicApi.geo.localities(one(sp.city)!)).items;
  } catch (e) { error = e instanceof ApiError && e.status === 400 ? "Some filters are not valid. Please adjust them." : "Search is unavailable right now. Please try again."; }

  const view = one(sp.view) === "map" ? "map" : "list";
  const page = Number(one(sp.page) ?? 1);
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of many(v)) p.append(k, x);
    for (const [k, v] of Object.entries(patch)) { p.delete(k); if (v) p.set(k, v); }
    return `/search?${p}`;
  };
  const tx = one(sp.transaction);
  const priceHint = tx === "RENT" ? "Monthly rent in ₹" : "Price in ₹";

  return (
    <div className="container">
      <div className="search-layout">
        <aside id="filters" className="filters card card-pad" aria-label="Filters">
          <form method="get" action="/search">
            <h2 style={{ fontSize: "1.1rem" }}>Filters</h2>
            <div className="field"><label htmlFor="f-tx">Looking to</label>
              <select id="f-tx" name="transaction" defaultValue={tx ?? ""}><option value="">Any</option><option value="RENT">Rent</option><option value="SALE">Buy</option><option value="LEASE">Lease</option></select></div>
            <div className="field"><label htmlFor="f-city">City</label>
              <select id="f-city" name="city" defaultValue={one(sp.city) ?? ""}><option value="">All cities</option>{cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
            {localities.length > 0 && <div className="field"><label htmlFor="f-loc">Locality</label>
              <select id="f-loc" name="locality" defaultValue={one(sp.locality) ?? ""}><option value="">All localities</option>{localities.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}</select></div>}
            <div className="field"><label htmlFor="f-q">Keyword, landmark or PIN</label><input id="f-q" className="input" name="q" defaultValue={one(sp.q) ?? ""} /></div>
            <div className="field"><label htmlFor="f-cat">Property type</label>
              <select id="f-cat" name="category" defaultValue={one(sp.category) ?? ""}><option value="">All types</option>{PROPERTY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></div>
            <fieldset className="field" style={{ border: 0, padding: 0 }}><legend style={{ fontWeight: 600, fontSize: ".92rem" }}>{priceHint}</legend>
              <div className="grid-2"><input aria-label="Minimum" className="input" name="minPrice" inputMode="numeric" placeholder="Min" defaultValue={one(sp.minPrice) ?? ""} /><input aria-label="Maximum" className="input" name="maxPrice" inputMode="numeric" placeholder="Max" defaultValue={one(sp.maxPrice) ?? ""} /></div></fieldset>
            <div className="field"><label htmlFor="f-bed">Bedrooms</label>
              <select id="f-bed" name="bedrooms" defaultValue={one(sp.bedrooms) ?? ""}><option value="">Any</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} BHK</option>)}<option value="5">5+ BHK</option></select></div>
            <details><summary>More filters</summary>
              <div className="field"><label htmlFor="f-furn">Furnishing</label>
                <select id="f-furn" name="furnishing" defaultValue={one(sp.furnishing) ?? ""}><option value="">Any</option><option value="FURNISHED">Furnished</option><option value="SEMI_FURNISHED">Semi-furnished</option><option value="UNFURNISHED">Unfurnished</option></select></div>
              <div className="field"><label htmlFor="f-adv">Posted by</label>
                <select id="f-adv" name="advertiserType" defaultValue={one(sp.advertiserType) ?? ""}><option value="">Anyone</option>{ADVERTISER_TYPES.map((a) => <option key={a} value={a}>{ADVERTISER_LABEL[a]}</option>)}</select></div>
              <fieldset className="field" style={{ border: 0, padding: 0 }}><legend style={{ fontWeight: 600, fontSize: ".92rem" }}>Area (sq ft)</legend>
                <div className="grid-2"><input aria-label="Minimum area" className="input" name="minArea" inputMode="numeric" placeholder="Min" defaultValue={one(sp.minArea) ?? ""} /><input aria-label="Maximum area" className="input" name="maxArea" inputMode="numeric" placeholder="Max" defaultValue={one(sp.maxArea) ?? ""} /></div></fieldset>
              <fieldset className="field" style={{ border: 0, padding: 0 }}><legend style={{ fontWeight: 600, fontSize: ".92rem" }}>Amenities</legend>
                {AMENITIES.slice(0, 10).map((a) => <label key={a} className="check"><input type="checkbox" name="amenities" value={a} defaultChecked={many(sp.amenities).includes(a)} />{AMENITY_LABEL(a)}</label>)}</fieldset>
            </details>
            <input type="hidden" name="sort" value={one(sp.sort) ?? "relevance"} />
            <div className="row" style={{ marginTop: 12 }}><button className="btn btn-primary">Apply</button><Link href="/search" className="btn btn-ghost">Clear</Link></div>
          </form>
        </aside>

        <section aria-live="polite">
          <div className="row" style={{ marginBottom: 12 }}>
            <a href="#filters" className="btn btn-ghost btn-sm show-sm">Filters</a><h1 style={{ fontSize: "1.3rem", margin: 0 }}>{res ? `${res.total.toLocaleString("en-IN")} ${res.total === 1 ? "property" : "properties"}` : "Search"}</h1>
            <div className="spacer" />
            <SaveSearch query={Object.fromEntries(Object.entries(query).filter(([k]) => !["page", "sort", "bbox"].includes(k)))} suggestedName={[one(sp.transaction) === "SALE" ? "Buy" : one(sp.transaction) === "RENT" ? "Rent" : "Properties", localities.find((x) => x.slug === one(sp.locality))?.name ?? cities.find((c) => c.slug === one(sp.city))?.name].filter(Boolean).join(" in ") || "My search"} />
            <nav className="row" aria-label="Sort and view" style={{ gap: 6 }}>
              {[["relevance", "Relevance"], ["newest", "Newest"], ["price_asc", "Price ↑"], ["price_desc", "Price ↓"]].map(([v, l]) => (
                <Link key={v} href={link({ sort: v, page: undefined })} className={`btn btn-sm ${(one(sp.sort) ?? "relevance") === v ? "btn-navy" : "btn-ghost"}`} aria-current={(one(sp.sort) ?? "relevance") === v ? "true" : undefined}>{l}</Link>
              ))}
              <Link href={link({ view: view === "map" ? undefined : "map" })} className="btn btn-sm btn-ghost">{view === "map" ? "List view" : "Map view"}</Link>
            </nav>
          </div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {res && res.items.length === 0 && <div className="empty card"><h2>No properties match these filters</h2><p>Try removing a filter or searching a nearby locality.</p><Link href="/search" className="btn btn-ghost">Clear filters</Link></div>}
          {res && res.items.length > 0 && (view === "map"
            ? <div className="stack"><MapView items={res.items} /><p className="small muted">Map pins show approximate areas, not exact addresses.</p><div className="listing-grid">{res.items.map((l) => <ListingCard key={l.id} l={l} />)}</div></div>
            : <div className="listing-grid">{res.items.map((l) => <ListingCard key={l.id} l={l} />)}</div>)}
          {res && res.totalPages > 1 && (
            <nav className="pager" aria-label="Pagination">
              {page > 1 && <Link className="btn btn-ghost btn-sm" href={link({ page: String(page - 1) })}>Previous</Link>}
              <span className="btn btn-sm" aria-current="page">Page {page} of {res.totalPages}</span>
              {page < res.totalPages && <Link className="btn btn-ghost btn-sm" href={link({ page: String(page + 1) })}>Next</Link>}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
