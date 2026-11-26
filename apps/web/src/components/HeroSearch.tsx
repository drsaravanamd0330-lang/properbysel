"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_LABEL, PROPERTY_CATEGORIES } from "@pbs/domain";
import type { City } from "@pbs/api-client";

export function HeroSearch({ cities }: { cities: City[] }) {
  const router = useRouter();
  const [tx, setTx] = useState<"RENT" | "SALE" | "SELL">("RENT");
  const [city, setCity] = useState("chennai");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tx === "SELL") { router.push("/post-property"); return; }
    const p = new URLSearchParams({ transaction: tx, city });
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    router.push(`/search?${p}`);
  }
  return (
    <form className="search-box" onSubmit={submit} role="search" aria-label="Property search">
      <div className="tabs" role="tablist" aria-label="What are you looking for?">
        {([["RENT", "Rent"], ["SALE", "Buy"], ["SELL", "Sell"]] as const).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tx === v} className="tab" onClick={() => setTx(v)}>{label}</button>
        ))}
      </div>
      {tx === "SELL" ? (
        <div className="row"><p style={{ margin: 0 }}>List your home, land or commercial property in a few minutes.</p><div className="spacer" /><button className="btn btn-primary">Post property</button></div>
      ) : (
        <div className="search-row">
          <div><label htmlFor="hs-city" className="small">City</label>
            <select id="hs-city" value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select></div>
          <div><label htmlFor="hs-q" className="small">Locality, landmark or PIN code</label>
            <input id="hs-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Adyar, 600020, near metro" /></div>
          <div><label htmlFor="hs-cat" className="small">Property type</label>
            <select id="hs-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All types</option>
              {PROPERTY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select></div>
          <div style={{ alignSelf: "end" }}><button className="btn btn-primary" style={{ width: "100%" }}>Search</button></div>
        </div>
      )}
    </form>
  );
}
