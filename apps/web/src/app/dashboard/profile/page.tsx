"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";

function ProfileForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { data, error, loading, reload } = useApi(() => api.me.get());
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (data) { setName(data.name ?? ""); setEmail(data.email ?? ""); } }, [data]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setErrs({});
    try { await api.me.update({ name, email }); setMsg("Profile saved."); if (next?.startsWith("/")) router.push(next); }
    catch (e) { if (e instanceof ApiError) setErrs(e.fieldErrors); setMsg(e instanceof ApiError ? e.message : "Could not save"); }
  }
  if (loading) return <Loading />; if (error) return <ErrorBox error={error} retry={reload} />;
  async function deleteAccount() {
    if (window.prompt("This closes all your listings and signs you out everywhere. Paid receipts are kept as required by law. Type DELETE to confirm.") !== "DELETE") return;
    try { await api.me.deleteAccount(); await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Could not delete the account"); }
  }
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
    <form className="card card-pad" onSubmit={save}>
      <h1 style={{ fontSize: "1.4rem" }}>Profile</h1>
      <p className="small muted">Mobile: {data?.phone} · Roles: {data?.roles.join(", ")}</p>
      <div className="field"><label htmlFor="n">Name</label><input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errs.name} />{errs.name && <p className="field-error">{errs.name}</p>}</div>
      <div className="field"><label htmlFor="em">Email (optional)</label><input id="em" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.email} />{errs.email && <p className="field-error">{errs.email}</p>}</div>
      {msg && <p className="small" role="status">{msg}</p>}
      <button className="btn btn-primary">Save</button>
    </form>
    <div className="card card-pad"><h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>Delete account</h2><p className="small muted">Closes your listings, removes your profile and signs you out on every device.</p><button type="button" className="btn btn-ghost btn-sm" onClick={deleteAccount}>Delete my account</button></div>
    </div>
  );
}
export default function Profile() { return <Suspense><ProfileForm /></Suspense>; }
