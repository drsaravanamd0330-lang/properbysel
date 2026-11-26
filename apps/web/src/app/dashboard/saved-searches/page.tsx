"use client";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDate } from "@/lib/format";

const toQs = (q: Record<string, unknown>) => new URLSearchParams(Object.entries(q).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, String(x)]) : [[k, String(v)]]))).toString();
const describe = (q: Record<string, unknown>) => Object.entries(q).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : String(v)}`).join(" · ");

export default function SavedSearches() {
  const { data, error, loading, reload } = useApi(() => api.saved.list());
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Saved searches</h1>
      <p className="muted small">We check for new matching listings every 15 minutes and send an in-app notification. Email and SMS alerts are not switched on yet.</p>
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card"><h2>No saved searches</h2><p>Run a search and choose “Save search”.</p><Link className="btn btn-primary" href="/search?city=chennai">Search Chennai</Link></div>}
      {data && data.items.map((s) => (
        <div key={s.id} className="card card-pad row" style={{ flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}><b>{s.name}</b><div className="small muted">{describe(s.query)}</div><div className="small muted">Saved {fmtDate(s.createdAt)}</div></div>
          <label className="row small"><input type="checkbox" checked={s.alerts} onChange={async (e) => { await api.saved.update(s.id, { alerts: e.target.checked }); reload(); }} /> Alerts</label>
          <Link className="btn btn-ghost btn-sm" href={`/search?${toQs(s.query)}`}>Open</Link>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await api.saved.remove(s.id); reload(); }}>Delete</button>
        </div>
      ))}
    </div>
  );
}
