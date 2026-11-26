"use client";
import { useState } from "react";
import { inrExact as formatINR } from "@/lib/format";
import { ApiError, type OrderStatus } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDateTime, statusLabel } from "@/lib/format";

export default function AdminOrders() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const { data, error, loading, reload } = useApi(() => api.admin.orders(status || undefined), [status]);
  const flags = useApi(() => api.admin.flags());
  const [msg, setMsg] = useState<string | null>(null);
  async function refund(id: string) {
    if (!window.confirm("Refund this order and remove its placement?")) return;
    try { await api.admin.refund(id); setMsg("Refund recorded."); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Refund failed"); }
  }
  async function toggle(key: string, enabled: boolean) { await api.admin.setFlag(key, enabled); flags.reload(); }
  return (
    <div className="stack">
      <div className="row"><h1 style={{ margin: 0 }}>Orders</h1><div className="spacer" />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
          <option value="">All</option>{["PENDING", "PAID", "FAILED", "REFUNDED"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select></div>
      {msg && <div className="alert alert-info" role="status">{msg}</div>}
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {data && <div className="table-wrap card"><table className="table">
        <thead><tr><th>When</th><th>Customer</th><th>Plan</th><th>Total</th><th>Status</th><th>Provider</th><th /></tr></thead>
        <tbody>{data.items.map((o) => <tr key={o.id}>
          <td className="small">{fmtDateTime(o.createdAt)}</td><td>{o.user.name ?? "—"}</td><td>{o.plan.name}<div className="small muted">{o.invoiceNumber}</div></td>
          <td>{formatINR(o.totalPaise)}</td><td>{statusLabel(o.status)}</td><td className="small">{o.provider}</td>
          <td>{o.status === "PAID" && <button className="btn btn-ghost btn-sm" onClick={() => refund(o.id)}>Refund</button>}</td>
        </tr>)}</tbody></table></div>}
      <h2>Feature flags</h2>
      <div className="card card-pad stack">
        {["manual_photoshoot", ...(flags.data?.items.map((f) => f.key) ?? [])].filter((k, i, a) => a.indexOf(k) === i).map((k) => {
          const on = !!flags.data?.items.find((f) => f.key === k)?.enabled;
          return <label key={k} className="row"><input type="checkbox" checked={on} onChange={(e) => toggle(k, e.target.checked)} /> <code>{k}</code></label>;
        })}
      </div>
    </div>
  );
}
