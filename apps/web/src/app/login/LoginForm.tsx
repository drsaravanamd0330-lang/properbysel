"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { phoneSchema } from "@pbs/validation";

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const p = phoneSchema.safeParse(phone);
    if (!p.success) { setErr(p.error.issues[0]!.message); return; }
    if (!agree) { setErr("Please accept the terms and privacy policy to continue"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: p.data }) });
      const b = await r.json();
      if (!r.ok) { setErr(b.error?.message ?? "Could not send the code"); return; }
      setPhone(p.data); setStep("code");
      setInfo(b.provider.startsWith("development") ? "Development mode: the code is printed in the API server log. No SMS was sent." : `We sent a 6-digit code to ${p.data}.`);
    } catch { setErr("You appear to be offline. Try again."); } finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code, name: name.trim() || undefined }) });
      const b = await r.json();
      if (!r.ok) { setErr(b.error?.message ?? "Could not verify the code"); return; }
      router.push(b.isNew && !name ? `/dashboard/profile?next=${encodeURIComponent(safeNext)}` : safeNext); router.refresh();
    } catch { setErr("You appear to be offline. Try again."); } finally { setBusy(false); }
  }

  return (
    <div className="card card-pad">
      <h1 style={{ fontSize: "1.5rem" }}>Log in or sign up</h1>
      <p className="muted small">Use your mobile number. We will send a one-time code.</p>
      {step === "phone" ? (
        <form onSubmit={requestCode} noValidate>
          <div className="field"><label htmlFor="phone">Mobile number</label>
            <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}><span className="input" style={{ width: 64, display: "grid", placeItems: "center" }} aria-hidden>+91</span>
              <input id="phone" className="input" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!err} aria-describedby={err ? "login-err" : undefined} placeholder="98765 43210" /></div></div>
          <label className="check small"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree to the <a href="/terms" target="_blank">terms of use</a> and <a href="/privacy" target="_blank">privacy policy</a>.</label>
          {err && <p id="login-err" className="field-error" role="alert">{err}</p>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          {info && <div className="alert alert-info small" role="status">{info}</div>}
          <div className="field"><label htmlFor="code">6-digit code</label>
            <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-invalid={!!err} autoFocus /></div>
          <div className="field"><label htmlFor="name">Your name <span className="muted">(new accounts)</span></label><input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          {err && <p className="field-error" role="alert">{err}</p>}
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and continue"}</button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setStep("phone"); setCode(""); setErr(null); }}>Change number</button>
        </form>
      )}
    </div>
  );
}
