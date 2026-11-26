"use client";
import { use, useState } from "react";
import Link from "next/link";
import { inrExact as formatINR } from "@/lib/format";
import { ApiError } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";

export default function FeatureListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const listing = useApi(() => api.listings.get(id), [id]);
  const plans = useApi(() => api.billing.plans());
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const featured = (plans.data?.items ?? []).filter((p) => p.kind === "FEATURED_LISTING");

  async function pay() {
    if (!choice) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.billing.createOrder(choice, id);
      if (!r.checkoutUrl) { setErr("Online checkout for this payment provider is not set up yet."); return; }
      const ret = `${window.location.origin}/dashboard/orders/${r.order.id}`;
      window.location.href = `${r.checkoutUrl}?return=${encodeURIComponent(ret)}`;
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not start checkout"); }
    finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <Link href="/dashboard" className="small">← My listings</Link>
      <h1 style={{ margin: 0 }}>Feature this listing</h1>
      {(listing.loading || plans.loading) && <Loading />}
      {listing.error && <ErrorBox error={listing.error} />}
      {listing.data && <div className="card card-pad"><b>{listing.data.title}</b><div className="small muted">{listing.data.locality?.name}</div>
        {listing.data.status !== "PUBLISHED" && <div className="alert alert-error small" style={{ marginTop: 8 }}>Only live listings can be featured.</div>}</div>}
      <p className="muted">Featured listings appear in up to three “Sponsored” slots at the top of matching searches. They are clearly labelled and go through the same moderation as every other listing.</p>
      <fieldset className="stack" style={{ border: 0, padding: 0 }}>
        <legend className="sr-only">Choose a plan</legend>
        {featured.map((p) => (
          <label key={p.code} className="card card-pad row" style={{ cursor: "pointer", outline: choice === p.code ? "2px solid var(--brand, #0E7C66)" : undefined }}>
            <input type="radio" name="plan" value={p.code} checked={choice === p.code} onChange={() => setChoice(p.code)} />
            <span><b>{p.name}</b><br /><span className="small muted">{formatINR(p.pricePaise)} + GST {formatINR(p.taxPaise)} = <b>{formatINR(p.totalPaise)}</b></span></span>
          </label>
        ))}
      </fieldset>
      {err && <div className="alert alert-error" role="alert">{err}</div>}
      <button className="btn btn-primary" disabled={!choice || busy || listing.data?.status !== "PUBLISHED"} onClick={pay}>{busy ? "Starting checkout…" : "Continue to payment"}</button>
      <p className="small muted">Your placement starts only after the payment provider confirms the payment. If a payment fails, nothing is charged for the placement and you can try again.</p>
    </div>
  );
}
