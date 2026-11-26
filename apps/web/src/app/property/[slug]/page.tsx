import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { idFromListingSlug, formatINR, CATEGORY_GROUP, type PropertyCategory } from "@pbs/domain";
import { ApiError, type PublicListing } from "@pbs/api-client";
import { publicApi, freshApi } from "@/lib/server-api";
import { SITE_URL } from "@/lib/config";
import { headlinePrice, categoryLabel, advertiserLabel, areaLabel, txLabel, fmtDate, AMENITY_LABEL, statusLabel } from "@/lib/format";
import { ListingCard } from "@/components/ListingCard";
import { EnquiryPanel } from "@/components/EnquiryPanel";

type Loaded = { kind: "ok"; l: PublicListing } | { kind: "gone"; title?: string; status?: string } | { kind: "missing" };

async function load(slug: string): Promise<Loaded> {
  const id = idFromListingSlug(slug);
  if (!id) return { kind: "missing" };
  try { return { kind: "ok", l: await freshApi.property.get(id) }; }
  catch (e) {
    if (e instanceof ApiError && e.status === 410) { const d = e.body.details as { title?: string; status?: string }; return { kind: "gone", title: d?.title, status: d?.status }; }
    if (e instanceof ApiError && e.status === 404) return { kind: "missing" };
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await load((await params).slug);
  if (r.kind !== "ok") return { title: "Property not available", robots: { index: false } };
  const l = r.l;
  const desc = `${headlinePrice(l)} · ${categoryLabel(l.category)} ${txLabel(l.transaction).toLowerCase()} in ${l.locality?.name}, ${l.city?.name}. ${l.description?.slice(0, 120) ?? ""}`;
  return {
    title: l.title ?? "Property", description: desc, alternates: { canonical: l.path },
    openGraph: { title: l.title ?? "", description: desc, url: l.path, images: l.media[0] ? [{ url: l.media[0].url, width: 1200, height: 800 }] : [] },
    robots: l.isDemo ? { index: false } : undefined,
  };
}

const ATTR_LABEL: Record<string, string> = {
  bedrooms: "Bedrooms", bathrooms: "Bathrooms", balconies: "Balconies", floor: "Floor", totalFloors: "Total floors", furnishing: "Furnishing",
  parking: "Parking", ageYears: "Age (years)", carpetAreaSqft: "Carpet area (sq ft)", builtUpAreaSqft: "Built-up area (sq ft)", superBuiltUpAreaSqft: "Super built-up area (sq ft)",
  plotArea: "Plot area", plotAreaUnit: "Unit", frontageFt: "Frontage (ft)", roadAccess: "Road access", roadWidthFt: "Road width (ft)", permittedUseClaim: "Permitted use (as stated by advertiser)",
  water: "Water", electricity: "Electricity", suitableFor: "Suitable for", powerKva: "Power (kVA)", loadingAccess: "Loading access", ceilingHeightFt: "Ceiling height (ft)", parkingSlots: "Parking slots", washrooms: "Washrooms",
};
const fmtAttr = (v: unknown) => (typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "string" ? statusLabel(v) : typeof v === "number" ? v.toLocaleString("en-IN") : String(v));

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await load(slug);
  if (r.kind === "missing") notFound();
  if (r.kind === "gone") {
    return (
      <div className="container section"><div className="card card-pad center">
        <h1>This property is no longer available</h1>
        <p className="muted">{r.title ? `“${r.title}” ` : "This listing "}is {statusLabel(r.status ?? "unavailable").toLowerCase()} and is not accepting enquiries.</p>
        <Link className="btn btn-primary" href="/search">Find similar properties</Link>
      </div></div>
    );
  }
  const l = r.l;
  const similar = await publicApi.property.similar(l.id).catch(() => ({ items: [] as PublicListing[] }));
  const group = l.category ? CATEGORY_GROUP[l.category as PropertyCategory] : null;
  const attrs = Object.entries(l.attributes ?? {}).filter(([k, v]) => ATTR_LABEL[k] && v !== null && v !== "" && v !== undefined);

  const jsonLd = {
    "@context": "https://schema.org", "@type": "RealEstateListing", name: l.title, description: l.description, url: `${SITE_URL}${l.path}`,
    datePosted: l.publishedAt, image: l.media.map((m) => `${SITE_URL}${m.url}`),
    offers: { "@type": "Offer", priceCurrency: "INR", price: ((l.pricePaise ?? l.rentPaise ?? l.leasePaise ?? 0) / 100).toFixed(0), availability: "https://schema.org/InStock" },
    address: { "@type": "PostalAddress", addressLocality: l.locality?.name, addressRegion: l.city?.name, postalCode: l.postcode, addressCountry: "IN" },
  };

  return (
    <div className="container">
      {!l.isDemo && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <nav className="small" aria-label="Breadcrumb" style={{ padding: "12px 0" }}>
        <Link href="/">Home</Link> › <Link href={`/search?city=${l.city?.slug}`}>{l.city?.name}</Link> › <Link href={`/search?city=${l.city?.slug}&locality=${l.locality?.slug}`}>{l.locality?.name}</Link>
      </nav>
      {l.media.length > 0 ? (
        <div className="gallery">
          <img src={l.media[0]!.url} alt={`Photo 1 of ${l.title}`} width={1200} height={800} />
          <div className="side">{l.media.slice(1, 3).map((m, i) => <img key={m.id} src={m.url} alt={`Photo ${i + 2} of ${l.title}`} loading="lazy" width={600} height={400} />)}</div>
        </div>
      ) : <div className="card card-pad muted center">No photos added yet.</div>}

      <div className="detail-layout">
        <article className="stack">
          <div className="row" style={{ gap: 6 }}>
            {l.isSponsored && <span className="badge badge-sponsored">Sponsored</span>}
            {l.isDemo && <span className="badge badge-demo">Demo listing – sample data</span>}
            <span className="badge">{txLabel(l.transaction)}</span>
            <span className="badge">{categoryLabel(l.category)}</span>
            {l.verifications.map((v) => <span key={v} className="badge badge-ok">✓ {v}</span>)}
          </div>
          <h1>{l.title}</h1>
          <p className="muted" style={{ marginTop: -6 }}>{[l.landmark, l.locality?.name, l.city?.name, l.postcode].filter(Boolean).join(", ")}</p>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--navy-900)" }}>{headlinePrice(l)} {l.negotiable && <span className="badge">Negotiable</span>}</div>

          <div className="facts">
            {l.bedrooms !== null && <div className="fact"><span className="small muted">Configuration</span><b>{l.bedrooms} BHK</b></div>}
            {areaLabel(l) && <div className="fact"><span className="small muted">Area</span><b>{areaLabel(l)}</b></div>}
            {l.furnishing && <div className="fact"><span className="small muted">Furnishing</span><b>{statusLabel(l.furnishing)}</b></div>}
            {l.availableFrom && <div className="fact"><span className="small muted">Available from</span><b>{fmtDate(l.availableFrom)}</b></div>}
            <div className="fact"><span className="small muted">Posted by</span><b>{advertiserLabel(l.advertiserType)}</b></div>
          </div>

          <section className="card card-pad"><h2>About this property</h2><p style={{ whiteSpace: "pre-line" }}>{l.description}</p>
            {l.investmentSuitable && <p className="small muted">The advertiser marked this as suitable for investment. ProperBySel does not promise or estimate returns.</p>}
          </section>

          <section className="card card-pad"><h2>Price details</h2>
            <table className="price-table"><tbody>
              {l.pricePaise ? <tr><td>Sale price</td><td>{formatINR(l.pricePaise)}</td></tr> : null}
              {l.rentPaise ? <tr><td>Monthly rent</td><td>{formatINR(l.rentPaise)}</td></tr> : null}
              {l.leasePaise ? <tr><td>Lease amount</td><td>{formatINR(l.leasePaise)}</td></tr> : null}
              {l.depositPaise ? <tr><td>Security deposit</td><td>{formatINR(l.depositPaise)}</td></tr> : null}
              {l.maintenancePaise ? <tr><td>Maintenance (monthly)</td><td>{formatINR(l.maintenancePaise)}</td></tr> : null}
              <tr><td>Brokerage</td><td>{l.brokerageDisclosure ?? (l.advertiserType === "OWNER" ? "None stated (posted by owner)" : "Ask the advertiser")}</td></tr>
            </tbody></table>
          </section>

          {attrs.length > 0 && <section className="card card-pad"><h2>{group === "LAND" ? "Land details" : group === "COMMERCIAL" ? "Commercial details" : "Property details"}</h2>
            <div className="facts">{attrs.map(([k, v]) => <div key={k} className="fact"><span className="small muted">{ATTR_LABEL[k]}</span><b>{fmtAttr(v)}</b></div>)}</div></section>}

          {l.amenities.length > 0 && <section className="card card-pad"><h2>Amenities</h2><div className="row">{l.amenities.map((a) => <span key={a} className="badge">{AMENITY_LABEL(a)}</span>)}</div></section>}

          <section className="card card-pad"><h2>Location</h2>
            <p className="muted small">Shown as an approximate area ({l.locality?.name}). The exact address is shared by the advertiser when you arrange a visit.</p>
            {l.approxLat && <a className="btn btn-ghost btn-sm" href={`https://www.openstreetmap.org/?mlat=${l.approxLat}&mlon=${l.approxLng}#map=14/${l.approxLat}/${l.approxLng}`} target="_blank" rel="noopener noreferrer">Open approximate area on map</a>}
          </section>
          <p className="small muted">Status: {statusLabel(l.status)} · Last updated {fmtDate(l.updatedAt)} · Listing ID {l.id.slice(-8)}</p>
        </article>

        <aside><div className="sticky"><EnquiryPanel listingId={l.id} advertiser={`${l.advertiserName ?? "Advertiser"} (${advertiserLabel(l.advertiserType)})`} canShowPhone={l.canShowPhone} /></div></aside>
      </div>

      {similar.items.length > 0 && <section className="section"><h2>Similar properties</h2><div className="listing-grid">{similar.items.map((s) => <ListingCard key={s.id} l={s} />)}</div></section>}
    </div>
  );
}
