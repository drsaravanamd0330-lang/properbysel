"use client";
import Link from "next/link";
import { inrExact as formatINR } from "@/lib/format";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDate, statusLabel } from "@/lib/format";

export default function Orders() {
  const { data, error, loading, reload } = useApi(() => api.billing.orders());
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Orders and receipts</h1>
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card"><h2>No orders yet</h2><p>Featured placement is optional. <Link href="/pricing">See pricing</Link>.</p></div>}
      {data && data.items.length > 0 && <div className="table-wrap card"><table className="table">
        <thead><tr><th>Plan</th><th>Total</th><th>Status</th><th>Placement</th><th /></tr></thead>
        <tbody>{data.items.map((o) => <tr key={o.id}>
          <td><b>{o.plan.name}</b><div className="small muted">{fmtDate(o.createdAt)}</div></td>
          <td>{formatINR(o.totalPaise)}</td>
          <td><span className={`badge badge-order-${o.status}`}>{statusLabel(o.status)}</span></td>
          <td className="small">{o.entitlement ? (o.entitlement.revoked ? "Revoked (refunded)" : `${fmtDate(o.entitlement.startsAt)} to ${fmtDate(o.entitlement.endsAt)}`) : "—"}</td>
          <td><Link className="btn btn-ghost btn-sm" href={`/dashboard/orders/${o.id}`}>Details</Link></td>
        </tr>)}</tbody></table></div>}
    </div>
  );
}
