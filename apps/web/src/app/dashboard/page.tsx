"use client";
import Link from "next/link";
import { useState } from "react";
import { ApiError, type OwnerListing } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { headlinePrice, statusLabel, fmtDate } from "@/lib/format";

type Action = "PAUSE" | "RESUME" | "MARK_SOLD" | "MARK_RENTED" | "ARCHIVE" | "RENEW";
function actionsFor(l: OwnerListing): [Action, string][] {
  switch (l.status) {
    case "PUBLISHED": return [["PAUSE", "Pause"], [l.transaction === "SALE" ? "MARK_SOLD" : "MARK_RENTED", l.transaction === "SALE" ? "Mark sold" : "Mark rented"]];
    case "PAUSED": return [["RESUME", "Resume"], ["ARCHIVE", "Archive"]];
    case "EXPIRED": return [["RENEW", "Renew"], ["ARCHIVE", "Archive"]];
    case "SOLD": case "RENTED": case "REJECTED": return [["ARCHIVE", "Archive"]];
    default: return [];
  }
}

export default function MyListings() {
  const { data, error, loading, reload } = useApi(() => api.me.listings());
  const [msg, setMsg] = useState<string | null>(null);
  async function act(l: OwnerListing, a: Action) {
    setMsg(null);
    try { await api.listings.action(l.id, a); setMsg(`“${l.title}” updated.`); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Could not update"); }
  }
  async function removeDraft(l: OwnerListing) {
    if (!window.confirm("Delete this draft? This cannot be undone.")) return;
    await api.listings.remove(l.id).catch(() => undefined); reload();
  }
  return (
    <div className="stack">
      <div className="row"><h1 style={{ margin: 0 }}>My listings</h1><div className="spacer" /><Link href="/post-property" className="btn btn-primary btn-sm">New listing</Link></div>
      {msg && <div className="alert alert-info" role="status">{msg}</div>}
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card"><h2>You have no listings yet</h2><p>Post your first property. It is free.</p><Link className="btn btn-primary" href="/post-property">Post property</Link></div>}
      {data && data.items.length > 0 && <div className="table-wrap card"><table className="table">
        <thead><tr><th>Property</th><th>Status</th><th>Enquiries</th><th>Actions</th></tr></thead>
        <tbody>{data.items.map((l) => <tr key={l.id}>
          <td><b>{l.title || "Untitled draft"}</b><div className="small muted">{headlinePrice(l)} · {l.locality?.name ?? "No location yet"}</div>
            {l.status === "PUBLISHED" && <Link className="small" href={l.path}>View public page</Link>}</td>
          <td><span className={`badge badge-status-${l.status}`}>{statusLabel(l.status)}</span>{l.isSponsored && <span className="badge" style={{ marginLeft: 4 }}>Featured</span>}
            {l.expiresAt && l.status === "PUBLISHED" && <div className="small muted">Expires {fmtDate(l.expiresAt)}</div>}
            {l.status === "DRAFT" && <div className="small muted">Step {l.wizardStep} of 8</div>}</td>
          <td>{l.enquiryCount ?? 0}</td>
          <td><div className="row" style={{ gap: 6 }}>
            {["DRAFT", "CHANGES_REQUESTED", "REJECTED", "PUBLISHED", "PAUSED"].includes(l.status) && <Link className="btn btn-ghost btn-sm" href={`/post-property/${l.id}`}>{l.status === "DRAFT" ? "Continue" : "Edit"}</Link>}
            {l.status === "PUBLISHED" && <Link className="btn btn-ghost btn-sm" href={`/dashboard/feature/${l.id}`}>{l.isSponsored ? "Extend feature" : "Feature"}</Link>}
            {actionsFor(l).map(([a, label]) => <button key={a} className="btn btn-ghost btn-sm" onClick={() => act(l, a)}>{label}</button>)}
            {l.status === "DRAFT" && <button className="btn btn-ghost btn-sm" onClick={() => removeDraft(l)}>Delete</button>}
          </div></td>
        </tr>)}</tbody></table></div>}
    </div>
  );
}
