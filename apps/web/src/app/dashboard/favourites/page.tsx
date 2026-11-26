"use client";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { headlinePrice } from "@/lib/format";

export default function Favourites() {
  const { data, error, loading, reload } = useApi(() => api.me.favourites());
  return (
    <div className="stack"><h1>Saved properties</h1>
      {loading && <Loading />}{error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card">Nothing saved yet. Tap “Save” on any property to keep it here.</div>}
      {data?.items.map((l) => <div key={l.id} className="card card-pad row">
        <div><b>{l.title}</b><div className="small muted">{headlinePrice(l)} · {l.locality?.name}</div>{!l.available && <span className="badge">No longer available</span>}</div><div className="spacer" />
        {l.available && <Link className="btn btn-ghost btn-sm" href={l.path}>View</Link>}
        <button className="btn btn-ghost btn-sm" onClick={async () => { await api.me.removeFavourite(l.id); reload(); }}>Remove</button></div>)}
    </div>
  );
}
