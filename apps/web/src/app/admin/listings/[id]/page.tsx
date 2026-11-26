"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@pbs/api-client";
import { formatINR } from "@pbs/domain";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { headlinePrice, statusLabel, categoryLabel, advertiserLabel, areaLabel, fmtDate, fmtDateTime } from "@/lib/format";

export default function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: l, error, loading, reload } = useApi(() => api.admin.listing(id), [id]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(d: "APPROVE" | "REQUEST_CHANGES" | "REJECT") {
    if (d !== "APPROVE" && note.trim().length < 5) { setErr("Write a note (at least 5 characters) explaining what needs to change."); return; }
    setBusy(true); setErr(null);
    try { await api.admin.decide(id, d, note.trim() || undefined); router.push("/admin"); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not save decision"); setBusy(false); }
  }
  async function openDoc(docId: string) {
    try { const r = await api.admin.documentUrl(docId); window.open(`/api/proxy${r.url}`, "_blank", "noopener"); } catch { setErr("Could not open document"); }
  }

  if (loading) return <Loading />; if (error) return <ErrorBox error={error} retry={reload} />; if (!l) return null;
  return (
    <div className="detail-layout" style={{ paddingTop: 0 }}>
      <div className="stack">
        <Link href="/admin" className="small">← Queue</Link>
        <div className="row"><span className={`badge badge-status-${l.status}`}>{statusLabel(l.status)}</span>{l.isDemo && <span className="badge badge-demo">Demo</span>}</div>
        <h1 style={{ fontSize: "1.4rem" }}>{l.title}</h1>
        <p className="muted">{categoryLabel(l.category)} · {headlinePrice(l)} · {areaLabel(l) ?? "no area"} · {advertiserLabel(l.advertiserType)}</p>
        {l.checks.length > 0 && <div className="alert alert-warn"><b>Automatic checks found problems:</b><ul>{l.checks.map((c) => <li key={c.path}>{c.message}</li>)}</ul></div>}
        <div className="photo-grid">{l.media.map((m, i) => <figure key={m.id}><img src={`/api/proxy${m.url}`} alt={`Photo ${i + 1}`} /></figure>)}</div>
        {l.media.length === 0 && <p className="small muted">No photos.</p>}
        <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Description</h2><p style={{ whiteSpace: "pre-line" }}>{l.description}</p></section>
        <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Location (private)</h2><p className="small">{l.address}<br />{l.landmark} · {l.locality?.name}, {l.city?.name} {l.postcode}<br />{l.lat && `${l.lat}, ${l.lng}`}</p></section>
        <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Pricing</h2><p className="small">
          {l.pricePaise ? `Sale ${formatINR(l.pricePaise)} · ` : ""}{l.rentPaise ? `Rent ${formatINR(l.rentPaise)} · ` : ""}{l.leasePaise ? `Lease ${formatINR(l.leasePaise)} · ` : ""}{l.depositPaise ? `Deposit ${formatINR(l.depositPaise)} · ` : ""}Brokerage: {l.brokerageDisclosure ?? "none stated"}</p></section>
        <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Attributes</h2><pre className="small" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(l.attributes, null, 2)}</pre></section>
        <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Private documents</h2>
          {l.documents.length === 0 ? <p className="small muted">None uploaded.</p> : <ul>{l.documents.map((d) => <li key={d.id}><button className="btn btn-ghost btn-sm" onClick={() => openDoc(d.id)}>{d.label}</button> <span className="small muted">{Math.round(d.bytes / 1024)} KB · opens a 5-minute link · access is logged</span></li>)}</ul>}</section>
        {l.reports.length > 0 && <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Reports</h2><ul>{l.reports.map((r) => <li key={r.id} className="small">{r.reason}: {r.details} ({r.status}, {fmtDate(r.createdAt)})</li>)}</ul></section>}
      </div>
      <aside><div className="sticky stack">
        <div className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Advertiser</h2><p className="small">{l.owner.name}<br />{l.owner.phone}<br />Member since {fmtDate(l.owner.memberSince)} · {l.owner.listingCount} listings</p></div>
        {l.status === "PENDING_REVIEW" ? <div className="card card-pad">
          <h2 style={{ fontSize: "1.05rem" }}>Decision</h2>
          <div className="field"><label htmlFor="note">Note to advertiser</label><textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Required when requesting changes or rejecting" /></div>
          {err && <p className="field-error" role="alert">{err}</p>}
          <div className="stack"><button className="btn btn-primary" disabled={busy} onClick={() => decide("APPROVE")}>Approve and publish</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => decide("REQUEST_CHANGES")}>Request changes</button>
            <button className="btn btn-danger" disabled={busy} onClick={() => decide("REJECT")}>Reject</button></div>
        </div> : <div className="alert alert-info small">Decisions are available only while the listing is pending review.</div>}
        <div className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>History</h2>{l.reviews.length === 0 ? <p className="small muted">No previous reviews.</p> : <ul className="small">{l.reviews.map((r) => <li key={r.id}>{fmtDateTime(r.createdAt)} · {r.decision} by {r.moderator.name}{r.note ? `: ${r.note}` : ""}</li>)}</ul>}</div>
      </div></aside>
    </div>
  );
}
