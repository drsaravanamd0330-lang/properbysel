"use client";
import { useState } from "react";
import Link from "next/link";
import { ApiError, type AdminUser } from "@pbs/api-client";
import { ROLES } from "@pbs/domain";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDate } from "@/lib/format";

export default function Users() {
  const [q, setQ] = useState(""), [term, setTerm] = useState("");
  const { data, error, loading, reload } = useApi(() => api.admin.users(term || undefined), [term]);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  async function saveRoles(u: AdminUser) {
    try { await api.admin.setRoles(u.id, roles); setMsg(`Roles updated for ${u.name ?? u.phone}. They will need to log in again.`); setEditing(null); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Could not update roles"); }
  }
  async function block(u: AdminUser) {
    const reason = window.prompt(u.blocked ? "Reason for unblocking" : "Reason for blocking (recorded in the audit log)");
    if (!reason || reason.trim().length < 3) return;
    try { await api.admin.block(u.id, !u.blocked, reason); setMsg(u.blocked ? "Unblocked." : "Blocked and signed out."); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Could not update"); }
  }
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Users and roles</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setTerm(q); }}><input aria-label="Search by name or phone" placeholder="Name or phone" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn btn-ghost btn-sm">Search</button></form>
      {msg && <div className="alert alert-info" role="status">{msg}</div>}
      {loading && <Loading />}
      {error && <ErrorBox error={error} retry={reload} />}
      {data && <div className="table-wrap card"><table className="table">
        <thead><tr><th>User</th><th>Roles</th><th>Listings</th><th>Joined</th><th /></tr></thead>
        <tbody>{data.items.map((u) => <tr key={u.id}>
          <td><b>{u.name ?? "—"}</b>{u.blocked && <span className="badge" style={{ marginLeft: 4 }}>Blocked</span>}{u.isDemo && <span className="badge" style={{ marginLeft: 4 }}>Demo</span>}<div className="small muted">{u.phone}</div></td>
          <td>{editing === u.id
            ? <div className="stack" style={{ gap: 2 }}>{ROLES.map((r) => <label key={r} className="small row"><input type="checkbox" checked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))} />{r}</label>)}
                <div className="row" style={{ gap: 4 }}><button className="btn btn-primary btn-sm" onClick={() => saveRoles(u)}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></div></div>
            : <span className="small">{u.roles.join(", ")}</span>}</td>
          <td>{u.listingCount}</td><td className="small">{fmtDate(u.createdAt)}</td>
          <td><div className="row" style={{ gap: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(u.id); setRoles(u.roles); }}>Roles</button>
            <button className="btn btn-ghost btn-sm" onClick={() => block(u)}>{u.blocked ? "Unblock" : "Block"}</button>
            <Link className="btn btn-ghost btn-sm" href={`/admin/audit?entityType=User&entityId=${u.id}`}>History</Link>
          </div></td>
        </tr>)}</tbody></table></div>}
      <p className="small muted">Changing roles or blocking signs the user out of every device. Existing access tokens expire within the configured access-token lifetime.</p>
    </div>
  );
}
