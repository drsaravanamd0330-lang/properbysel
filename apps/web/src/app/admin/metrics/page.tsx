"use client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { inrExact, fmtDateTime, statusLabel } from "@/lib/format";

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <div className="card card-pad"><div className="small muted">{label}</div><div style={{ fontSize: 28, fontWeight: 800, color: "var(--navy-900)" }}>{value}</div>{hint && <div className="small muted">{hint}</div>}</div>;
}

export default function MetricsPage() {
  const { data: m, error, loading, reload } = useApi(() => api.admin.metrics());
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Launch metrics</h1>
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {m && <>
        <p className="small muted">Generated {fmtDateTime(m.generatedAt)}. Demo users and demo listings are excluded.</p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Tile label="Live listings" value={m.listings.live} hint={`${m.listings.activeAdvertisers30d} advertisers published in 30 days`} />
          <Tile label="Enquiries, 7 days" value={m.demand.enquiries7d} hint={`${m.demand.enquiries30d} in 30 days`} />
          <Tile label="Enquiries per live listing, 30 days" value={m.demand.enquiriesPerLiveListing30d ?? "—"} />
          <Tile label="Users" value={m.users.total} hint={`${m.users.new7d} new in 7 days`} />
          <Tile label="Awaiting review" value={m.moderation.pending} hint={m.moderation.oldestPendingHours !== null ? `Oldest waiting ${m.moderation.oldestPendingHours} h` : "Queue empty"} />
          <Tile label="Median review time, 30 days" value={m.moderation.medianReviewHours30d !== null ? `${m.moderation.medianReviewHours30d} h` : "—"} hint="Target: under 24 h" />
          <Tile label="Open reports" value={m.moderation.openReports} />
          <Tile label="Revenue, 30 days (excl. GST)" value={inrExact(m.revenue.netOfGstPaise30d)} hint={`${m.revenue.paidOrders30d} paid orders`} />
        </div>
        <div className="card card-pad"><h2 style={{ marginTop: 0 }}>Listings by status</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>{Object.entries(m.listings.byStatus).map(([k, v]) => <span key={k} className="badge">{statusLabel(k)}: {v}</span>)}</div></div>
      </>}
    </div>
  );
}
