"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@pbs/api-client";
import { api, newIdempotencyKey } from "@/lib/client-api";

export function EnquiryPanel({ listingId, advertiser, canShowPhone }: { listingId: string; advertiser: string; canShowPhone: boolean }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("Hi, I am interested in this property. Is it still available?");
  const [share, setShare] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [conv, setConv] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const key = useRef(newIdempotencyKey());

  useEffect(() => { setSignedIn(document.cookie.includes("pbs_roles=")); }, []);
  const next = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname) : "";

  async function send(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setState("sending");
    try {
      const r = await api.property.enquire(listingId, msg, share, key.current);
      setConv(r.conversationId); setState("sent");
    } catch (e) {
      setState("idle");
      if (e instanceof ApiError && e.status === 401) { window.location.href = `/login?next=${next}`; return; }
      setErr(e instanceof ApiError ? e.message : "Could not send. Please try again.");
    }
  }
  async function revealPhone() {
    try { const r = await api.property.contact(listingId); setPhone(r.available ? `${r.name ?? ""} · ${r.phone}` : r.reason ?? "Not available"); }
    catch (e) { setPhone(e instanceof ApiError ? e.message : "Could not load contact"); }
  }
  async function toggleSave() {
    try { const r = saved ? await api.me.removeFavourite(listingId) : await api.me.addFavourite(listingId); setSaved(r.saved); }
    catch (e) { if (e instanceof ApiError && e.status === 401) window.location.href = `/login?next=${next}`; }
  }
  async function report(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try { await api.property.report(listingId, String(f.get("reason")), String(f.get("details") ?? "")); setReportDone(true); }
    catch (e) { if (e instanceof ApiError && e.status === 401) window.location.href = `/login?next=${next}`; else setErr("Could not send the report."); }
  }

  return (
    <div className="stack">
      <div className="card card-pad">
        <h2 style={{ fontSize: "1.15rem" }}>Contact {advertiser}</h2>
        {signedIn === false && <p className="small muted">You need to <Link href={`/login?next=${next}`}>log in with your phone number</Link> to send an enquiry. This keeps spam away from advertisers.</p>}
        {state === "sent" ? (
          <div className="alert alert-ok" role="status">Your enquiry was sent. <Link href={`/dashboard/messages/${conv}`}>Open conversation</Link></div>
        ) : (
          <form onSubmit={send} noValidate>
            <div className="field"><label htmlFor="enq-msg">Message</label><textarea id="enq-msg" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} required aria-invalid={!!err} /></div>
            <label className="check small"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />Share my phone number with this advertiser</label>
            {err && <div className="field-error" role="alert">{err}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 10 }} disabled={state === "sending" || msg.trim().length < 5}>{state === "sending" ? "Sending…" : "Send enquiry"}</button>
          </form>
        )}
        {canShowPhone && <div style={{ marginTop: 10 }}>{phone ? <p className="small" role="status">{phone}</p> : <button className="btn btn-ghost btn-sm" onClick={revealPhone} disabled={state !== "sent" && signedIn !== true}>Show phone number</button>}<p className="hint">Available after you send an enquiry.</p></div>}
      </div>
      <div className="row">
        <button className="btn btn-ghost btn-sm" onClick={toggleSave} aria-pressed={saved}>{saved ? "★ Saved" : "☆ Save"}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen((o) => !o)} aria-expanded={reportOpen}>Report listing</button>
      </div>
      {reportOpen && (reportDone ? <div className="alert alert-ok" role="status">Thanks. Our moderation team will review this listing.</div> : (
        <form className="card card-pad" onSubmit={report}>
          <div className="field"><label htmlFor="rep-reason">Reason</label>
            <select id="rep-reason" name="reason"><option value="FRAUD">Suspected fraud or scam</option><option value="WRONG_INFO">Wrong information</option><option value="ALREADY_SOLD">Already sold or rented</option><option value="DUPLICATE">Duplicate listing</option><option value="OFFENSIVE">Offensive content</option><option value="OTHER">Other</option></select></div>
          <div className="field"><label htmlFor="rep-details">Details (optional)</label><textarea id="rep-details" name="details" maxLength={1000} /></div>
          <button className="btn btn-navy btn-sm">Send report</button>
        </form>
      ))}
      <div className="alert alert-info small">Never pay a token advance before visiting the property and checking documents. <Link href="/safety">Safety tips</Link></div>
    </div>
  );
}
