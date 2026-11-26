"use client";
import { use, useState } from "react";
import Link from "next/link";
import { LEAD_STAGES, type LeadStage } from "@pbs/domain";
import { ApiError } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDateTime, statusLabel } from "@/lib/format";

export default function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload, setData } = useApi(() => api.conversations.get(id), [id]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [visitAt, setVisitAt] = useState("");
  const [notes, setNotes] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!body.trim() || !data) return;
    setSending(true); setErr(null);
    try { const m = await api.conversations.send(id, body.trim()); setData({ ...data, messages: [...data.messages, m] }); setBody(""); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Message not sent. Try again."); } finally { setSending(false); }
  }
  async function stage(s: LeadStage) { if (data?.enquiryId) { await api.leads.update(data.enquiryId, { stage: s }); setNotes(`Stage set to ${statusLabel(s)}`); } }
  async function requestVisit() {
    if (!data?.enquiryId || !visitAt) return;
    try { await api.leads.requestVisit(data.enquiryId, new Date(visitAt).toISOString()); setVisitAt(""); reload(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not request visit"); }
  }
  async function visitAction(vid: string, action: string) {
    try { await api.leads.visitAction(vid, action); reload(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not update visit"); }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return null;
  const other = data.participants.find((p) => !p.isMe);
  return (
    <div className="stack">
      <Link href={data.myRole === "ADVERTISER" ? "/dashboard/inbox" : "/dashboard/enquiries"} className="small">← Back</Link>
      <h1 style={{ fontSize: "1.3rem" }}>{other?.name ?? "Conversation"}</h1>
      {data.listing && <p className="muted small" style={{ marginTop: -8 }}>About: {data.listing.title} ({statusLabel(data.listing.status)})</p>}
      {data.myRole === "ADVERTISER" && data.enquiryId && <div className="row"><label htmlFor="stage" style={{ margin: 0 }}>Lead stage</label>
        <select id="stage" style={{ width: "auto" }} onChange={(e) => stage(e.target.value as LeadStage)} defaultValue=""><option value="" disabled>Change stage</option>{LEAD_STAGES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>{notes && <span className="small" role="status">{notes}</span>}</div>}
      <div className="chat" aria-live="polite">{data.messages.map((m) => <div key={m.id} className={`bubble ${m.fromMe ? "me" : ""}`}><div>{m.body}</div><div className="small muted">{fmtDateTime(m.at)}</div></div>)}</div>
      {data.blocked ? <div className="alert alert-warn">This conversation is blocked.</div> : (
        <form onSubmit={send} className="row" style={{ flexWrap: "nowrap" }}>
          <label htmlFor="msg" className="sr-only" style={{ position: "absolute", left: -9999 }}>Message</label>
          <input id="msg" className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Write a message" />
          <button className="btn btn-primary" disabled={sending || !body.trim()}>{sending ? "Sending…" : "Send"}</button>
        </form>)}
      {err && <div className="alert alert-error" role="alert">{err}</div>}
      <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Visits</h2>
        {data.visits.length === 0 && <p className="small muted">No visits scheduled.</p>}
        <ul>{data.visits.map((v) => <li key={v.id} className="small">{fmtDateTime(v.proposedAt)} · <b>{statusLabel(v.status)}</b>{" "}
          {["REQUESTED", "RESCHEDULE_PROPOSED"].includes(v.status) && <><button className="btn btn-ghost btn-sm" onClick={() => visitAction(v.id, "ACCEPT")}>Accept</button><button className="btn btn-ghost btn-sm" onClick={() => visitAction(v.id, "DECLINE")}>Decline</button></>}
          {["REQUESTED", "RESCHEDULE_PROPOSED", "ACCEPTED"].includes(v.status) && <button className="btn btn-ghost btn-sm" onClick={() => visitAction(v.id, "CANCEL")}>Cancel</button>}
          {v.status === "ACCEPTED" && data.myRole === "ADVERTISER" && <button className="btn btn-ghost btn-sm" onClick={() => visitAction(v.id, "COMPLETE")}>Mark completed</button>}
        </li>)}</ul>
        {data.listing?.status === "PUBLISHED" && <div className="row"><label htmlFor="visit" style={{ margin: 0 }}>Propose a visit</label><input id="visit" type="datetime-local" className="input" style={{ width: "auto" }} value={visitAt} onChange={(e) => setVisitAt(e.target.value)} /><button className="btn btn-navy btn-sm" onClick={requestVisit} disabled={!visitAt}>Request</button></div>}
        <p className="hint">Accept or decline buttons work only for the person who did not propose the time.</p>
      </section>
      <button className="btn btn-ghost btn-sm" style={{ width: "fit-content" }} onClick={async () => { if (window.confirm("Block this person? They will not be able to message you.")) { await api.conversations.block(id); reload(); } }}>Block</button>
    </div>
  );
}
