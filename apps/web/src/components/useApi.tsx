"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@pbs/api-client";

/** Loads data with loading / error / unauthenticated states. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; }
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function Loading({ label = "Loading" }: { label?: string }) { return <div className="skeleton" style={{ height: 160 }} aria-busy="true" aria-label={label} />; }
export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return <div className="alert alert-error" role="alert">{error} {retry && <button className="btn btn-ghost btn-sm" onClick={retry}>Try again</button>}</div>;
}
