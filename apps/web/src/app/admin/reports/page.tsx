"use client";
import { useState } from "react";
import Link from "next/link";
import { ApiError } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDateTime, statusLabel } from "@/lib/format";

export default function Reports() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useApi(() => api.admin.reports(status || undefined), [status]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  async function act(id: string, action: "START_REVIEW" | "DISMISS" | "TAKE_DOWN") {
    setMsg(null);
    try { await api.admin.reportAction(id, action, notes[id]); setMsg(action === "TAKE_DOWN" ? "Listing hidden and owner asked to fix it." : "Report updated."); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Action failed"); }
  }
  return (
    <div className="stack">
      <div className="row"><h1 style={{ margin: 0 }}>Reports</h1><div className="spacer" />
        <select aria-label="Filter" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Open and in review</option><option value="ACTIONED">Actioned</option><option value="DISMISSED">Dismissed</option></select></div>
      <p className="small muted">Oldest first. “Take down” hides the listing and sends it back to the owner for changes; it then needs moderator approval again. Escalate suspected fraud using docs/business/SOPS.md.</p>
      {msg && <div className="alert alert-info" role="status">{msg}</div>}
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card"><h2>No reports here</h2></div>}
      {data && data.items.map((r) => (
        <div key={r.id} className="card card-pad stack">
          <div className="row" style={{ flexWrap: "wrap" }}><b>{statusLabel(r.reason)}</b><span className="badge">{statusLabel(r.status)}</span><span className="small muted">{fmtDateTime(r.createdAt)} by {r.reporter.name ?? "user"}</span></div>
          {r.listing ? <div className="small">Listing: <Link href={`/admin/listings/${r.listing.id}`}>{r.listing.title ?? "Untitled"}</Link> · {statusLabel(r.listing.status)} · {r.listing.reportCount} report(s) in total</div> : <div className="small muted">Listing deleted</div>}
          {r.details && <blockquote className="small" style={{ margin: 0 }}>{r.details}</blockquote>}
          {r.resolution && <div className="small">Resolution: {r.resolution}</div>}
          {["OPEN", "IN_REVIEW"].includes(r.status) && <>
            <label className="small">Note (sent to the owner on take down)<textarea rows={2} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={1000} style={{ width: "100%" }} /></label>
            <div className="row" style={{ gap: 6 }}>
              {r.status === "OPEN" && <button className="btn btn-ghost btn-sm" onClick={() => act(r.id, "START_REVIEW")}>Start review</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => act(r.id, "DISMISS")}>Dismiss</button>
              <button className="btn btn-sm btn-navy" onClick={() => act(r.id, "TAKE_DOWN")} disabled={!notes[r.id]?.trim()}>Take down listing</button>
            </div>
          </>}
        </div>
      ))}
    </div>
  );
}
