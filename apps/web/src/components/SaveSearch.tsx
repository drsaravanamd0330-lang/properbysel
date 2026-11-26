"use client";
import { useState } from "react";
import { ApiError } from "@pbs/api-client";
import { api } from "@/lib/client-api";

/** Saves the current filters. Logged-out users are sent to login and brought back. */
export function SaveSearch({ query, suggestedName }: { query: Record<string, unknown>; suggestedName: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function save() {
    setState("saving");
    try { await api.saved.create(suggestedName, query); setState("saved"); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; return; }
      setState("error"); setMsg(e instanceof ApiError ? e.message : "Could not save");
    }
  }
  if (state === "saved") return <span className="small" role="status">Saved. We will notify you about new matches. <a href="/dashboard/saved-searches">Manage</a></span>;
  return <>
    <button className="btn btn-ghost btn-sm" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save search"}</button>
    {state === "error" && <span className="small" role="alert" style={{ color: "var(--danger)" }}>{msg}</span>}
  </>;
}
