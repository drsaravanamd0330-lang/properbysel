"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, type OwnerListing } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { statusLabel, fmtDate } from "@/lib/format";

export function StartListing() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<OwnerListing[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.me.listings("DRAFT").then((r) => setDrafts(r.items)).catch((e) => { if (e instanceof ApiError && e.status === 401) setNeedLogin(true); else setDrafts([]); });
  }, []);
  async function start() {
    setBusy(true); setErr(null);
    try { const l = await api.listings.create({ wizardStep: 1 }); router.push(`/post-property/${l.id}`); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not start a listing"); setBusy(false); }
  }
  if (needLogin) return <div className="card card-pad"><p>Log in with your mobile number to post a property.</p><Link className="btn btn-primary" href="/login?next=/post-property">Log in to continue</Link></div>;
  if (!drafts) return <div className="skeleton" style={{ height: 120 }} aria-busy="true" />;
  return (
    <div className="stack">
      {drafts.length > 0 && <div className="card card-pad"><h2 style={{ fontSize: "1.1rem" }}>Continue a saved draft</h2>
        <ul>{drafts.map((d) => <li key={d.id}><Link href={`/post-property/${d.id}`}>{d.title || "Untitled draft"}</Link> <span className="small muted">· {statusLabel(d.status)} · step {d.wizardStep} of 8 · saved {fmtDate(d.updatedAt)}</span></li>)}</ul></div>}
      {err && <div className="alert alert-error" role="alert">{err}</div>}
      <button className="btn btn-primary" onClick={start} disabled={busy}>{busy ? "Starting…" : "Start a new listing"}</button>
    </div>
  );
}
