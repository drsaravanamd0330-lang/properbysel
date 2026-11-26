"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AuditEntry } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDateTime } from "@/lib/format";

function AuditInner() {
  const sp = useSearchParams();
  const [f, setF] = useState({ entityType: sp.get("entityType") ?? "", entityId: sp.get("entityId") ?? "", action: "" });
  const [applied, setApplied] = useState(f);
  const [older, setOlder] = useState<AuditEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi(async () => { const r = await api.admin.audit({ ...clean(applied) }); setOlder([]); setNext(r.nextBefore); return r; }, [applied]);
  const rows = [...(data?.items ?? []), ...older];
  async function more() { if (!next) return; const r = await api.admin.audit({ ...clean(applied), before: next }); setOlder([...older, ...r.items]); setNext(r.nextBefore); }
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Audit log</h1>
      <form className="row" style={{ flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); setApplied(f); }}>
        <input aria-label="Entity type" placeholder="Entity type (Listing, User, Order…)" value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })} />
        <input aria-label="Entity id" placeholder="Entity id" value={f.entityId} onChange={(e) => setF({ ...f, entityId: e.target.value })} />
        <input aria-label="Action contains" placeholder="Action contains" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} />
        <button className="btn btn-ghost btn-sm">Filter</button>
      </form>
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {data && <div className="table-wrap card"><table className="table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="small">{fmtDateTime(r.createdAt)}</td><td className="small">{r.actor?.name ?? (r.actor ? r.actor.id : "System")}</td><td><code className="small">{r.action}</code></td><td className="small">{r.entityType} <span className="muted">{r.entityId.slice(0, 10)}</span></td><td className="small"><code style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(r.meta)}</code></td></tr>)}</tbody>
      </table></div>}
      {next && <button className="btn btn-ghost btn-sm" onClick={more}>Load older</button>}
    </div>
  );
}
const clean = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v.trim()));
export default function AuditPage() { return <Suspense><AuditInner /></Suspense>; }
