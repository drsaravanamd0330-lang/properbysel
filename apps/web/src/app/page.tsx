import Link from "next/link";
import { CATEGORY_LABEL, PROPERTY_CATEGORIES } from "@pbs/domain";
import { publicApi } from "@/lib/server-api";
import { BRAND } from "@/lib/config";
import { HeroSearch } from "@/components/HeroSearch";
import { ListingCard } from "@/components/ListingCard";
import type { City, PublicListing } from "@pbs/api-client";

export default async function Home() {
  let cities: City[] = [], listings: PublicListing[] = [], localities: { name: string; slug: string }[] = [], failed = false;
  try {
    const [c, s, l] = await Promise.all([publicApi.geo.cities(), publicApi.search({ city: "chennai", pageSize: 8 }), publicApi.geo.localities("chennai")]);
    cities = c.items; listings = s.items; localities = l.items;
  } catch { failed = true; }

  return (
    <>
      <section className="hero">
        <div className="container stack">
          <div className="tag">{BRAND.secondary}</div>
          <h1>{BRAND.positioning}</h1>
          <p style={{ color: "#DCE6F2", maxWidth: 620, marginTop: 0 }}>Find a home to rent, land to buy, or a shop for your business. Every listing shows who posted it, so you know when brokerage applies.</p>
          <HeroSearch cities={cities.length ? cities : [{ id: "", name: "Chennai", slug: "chennai", state: "Tamil Nadu" }]} />
        </div>
      </section>

      <div className="container">
        {failed && <div className="alert alert-error" role="alert">We could not load listings right now. Please refresh in a moment.</div>}

        <section className="section" aria-labelledby="cat-h">
          <h2 id="cat-h">Browse by property type</h2>
          <div className="cat-grid">
            {PROPERTY_CATEGORIES.map((c) => <Link key={c} className="card cat" href={`/search?category=${c}&city=chennai`}>{CATEGORY_LABEL[c]}</Link>)}
          </div>
        </section>

        <section className="section" aria-labelledby="feat-h">
          <div className="row"><h2 id="feat-h" style={{ margin: 0 }}>Latest in Chennai</h2><div className="spacer" /><Link href="/search?city=chennai">View all</Link></div>
          <p className="small muted">Listings marked “Sponsored” are paid placements. Listings marked “Demo” are sample data for testing.</p>
          {listings.length ? <div className="listing-grid">{listings.map((l) => <ListingCard key={l.id} l={l} />)}</div>
            : !failed && <div className="empty card">No listings yet. <Link href="/post-property">Be the first to post one.</Link></div>}
        </section>

        <section className="section" aria-labelledby="loc-h">
          <h2 id="loc-h">Popular localities in Chennai</h2>
          <div className="row">{localities.map((l) => <Link key={l.slug} className="badge" style={{ padding: "8px 12px", textDecoration: "none" }} href={`/search?city=chennai&locality=${l.slug}`}>{l.name}</Link>)}</div>
        </section>

        <section className="section" aria-labelledby="how-h">
          <h2 id="how-h">How ProperBySel works</h2>
          <ol className="steps" style={{ padding: 0 }}>
            <li className="card"><h3>Post your property</h3><p className="muted small">Add details, photos and price. Your first listing is free. We review every listing before it goes live.</p></li>
            <li className="card"><h3>Get genuine enquiries</h3><p className="muted small">Interested people message you through ProperBySel. Your phone number stays hidden unless you choose to share it.</p></li>
            <li className="card"><h3>Visit and decide</h3><p className="muted small">Schedule visits, track each lead, and mark the property rented or sold when you are done.</p></li>
          </ol>
          <p className="small"><Link href="/pricing">See pricing</Link> · <Link href="/safety">Safety tips</Link> · <Link href="/help">Help centre</Link></p>
        </section>
      </div>
    </>
  );
}
