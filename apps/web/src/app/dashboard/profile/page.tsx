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
  return (
    <form className="card card-pad" onSubmit={save} style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: "1.4rem" }}>Profile</h1>
      <p className="small muted">Mobile: {data?.phone} · Roles: {data?.roles.join(", ")}</p>
      <div className="field"><label htmlFor="n">Name</label><input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errs.name} />{errs.name && <p className="field-error">{errs.name}</p>}</div>
      <div className="field"><label htmlFor="em">Email (optional)</label><input id="em" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.email} />{errs.email && <p className="field-error">{errs.email}</p>}</div>
      {msg && <p className="small" role="status">{msg}</p>}
      <button className="btn btn-primary">Save</button>
    </form>
  );
}
export default function Profile() { return <Suspense><ProfileForm /></Suspense>; }
