"use client";
import { use, useEffect } from "react";
import Link from "next/link";
import { inrExact as formatINR } from "@/lib/format";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDate, statusLabel } from "@/lib/format";

/** Shows the order as the server sees it. Arriving here from checkout proves nothing; only the verified webhook changes status. */
export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: o, error, loading, reload } = useApi(() => api.billing.order(id), [id]);
  useEffect(() => {
    if (o && (o.status === "PENDING" || o.status === "CREATED")) { const t = setTimeout(reload, 3000); return () => clearTimeout(t); }
  }, [o, reload]);
  return (
    <div className="stack">
      <Link href="/dashboard/orders" className="small">← Orders</Link>
      {loading && !o && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {o && <div className="card card-pad stack">
        <h1 style={{ margin: 0 }}>{o.plan.name}</h1>
        {o.status === "PAID" && <div className="alert alert-success" role="status">Payment confirmed. {o.entitlement && !o.entitlement.revoked && <>Your placement runs from {fmtDate(o.entitlement.startsAt)} to {fmtDate(o.entitlement.endsAt)}.</>}</div>}
        {(o.status === "PENDING" || o.status === "CREATED") && <div className="alert alert-info" role="status">Waiting for the payment provider to confirm. This page updates automatically.</div>}
        {o.status === "FAILED" && <div className="alert alert-error" role="alert">The payment did not go through. No placement was added. {o.listingId && <Link href={`/dashboard/feature/${o.listingId}`}>Try again</Link>}</div>}
        {o.status === "REFUNDED" && <div className="alert alert-info">This order was refunded and the placement was removed.</div>}
        <dl className="small" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", margin: 0 }}>
          <dt>Status</dt><dd>{statusLabel(o.status)}</dd>
          <dt>Price</dt><dd>{formatINR(o.amountPaise)}</dd>
          <dt>GST</dt><dd>{formatINR(o.taxPaise)}</dd>
          <dt>Total</dt><dd><b>{formatINR(o.totalPaise)}</b></dd>
          {o.invoiceNumber && <><dt>Receipt no.</dt><dd>{o.invoiceNumber}</dd></>}
        </dl>
        {o.invoiceNumber && <a className="btn btn-ghost btn-sm" href={`/api/proxy/v1/orders/${o.id}/receipt`} target="_blank" rel="noopener">View receipt</a>}
      </div>}
    </div>
  );
}
