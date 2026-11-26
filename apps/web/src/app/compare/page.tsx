"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PublicListing } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { readCompare, writeCompare } from "@/components/CompareButton";
import { headlinePrice, areaLabel, categoryLabel, advertiserLabel, txLabel, fmtDate } from "@/lib/format";

const ROWS: [string, (l: PublicListing) => React.ReactNode][] = [
  ["Price", (l) => headlinePrice(l)],
  ["Type", (l) => `${categoryLabel(l.category)} · ${txLabel(l.transaction)}`],
  ["Location", (l) => [l.locality?.name, l.city?.name].filter(Boolean).join(", ")],
  ["Area", (l) => areaLabel(l) ?? "—"],
  ["Bedrooms", (l) => l.bedrooms ?? "—"],
  ["Furnishing", (l) => (l.furnishing ? l.furnishing.toLowerCase().replace(/_/g, " ") : "—")],
  ["Posted by", (l) => advertiserLabel(l.advertiserType)],
  ["Listed", (l) => fmtDate(l.publishedAt)],
  ["Checks", (l) => (l.verifications.length ? l.verifications.join(", ") : "None yet")],
];

function CompareInner() {
  const sp = useSearchParams();
  const [ids, setIds] = useState<string[]>([]);
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  useEffect(() => {
    const fromUrl = (sp.get("ids") ?? "").split(",").filter(Boolean);
    setIds(fromUrl.length ? fromUrl.slice(0, 4) : readCompare());
  }, [sp]);
  useEffect(() => {
    if (!ids.length) { setItems([]); return; }
    api.compare(ids).then((r) => { setItems(r.items); setGone(r.unavailable); }).catch(() => setItems([]));
  }, [ids]);
  function remove(id: string) { const next = ids.filter((x) => x !== id); writeCompare(next); setIds(next); window.history.replaceState(null, "", next.length ? `/compare?ids=${next.join(",")}` : "/compare"); }
  return (
    <div className="container section">
      <h1>Compare properties</h1>
      {gone.length > 0 && <div className="alert alert-info">{gone.length} {gone.length === 1 ? "property is" : "properties are"} no longer available and {gone.length === 1 ? "was" : "were"} left out.</div>}
      {items === null && <div className="skeleton" style={{ height: 200 }} />}
      {items && items.length === 0 && <div className="empty card"><h2>Nothing to compare yet</h2><p>Open a property and choose “Add to compare”. You can compare up to four.</p><Link className="btn btn-primary" href="/search">Search properties</Link></div>}
      {items && items.length > 0 && <div className="table-wrap card"><table className="table">
        <thead><tr><th scope="col"><span className="sr-only">Detail</span></th>{items.map((l) => <th key={l.id} scope="col"><Link href={l.path}>{l.title}</Link><br /><button className="btn btn-ghost btn-sm" onClick={() => remove(l.id)}>Remove</button></th>)}</tr></thead>
        <tbody>{ROWS.map(([label, f]) => <tr key={label}><th scope="row">{label}</th>{items.map((l) => <td key={l.id}>{f(l)}</td>)}</tr>)}</tbody>
      </table></div>}
    </div>
  );
}
export default function ComparePage() { return <Suspense><CompareInner /></Suspense>; }
