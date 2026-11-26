"use client";
import { useEffect, useState } from "react";

const KEY = "pbs_compare";
export const MAX_COMPARE = 4;
export function readCompare(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_COMPARE) : []; } catch { return []; }
}
export function writeCompare(ids: string[]) { try { localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_COMPARE))); } catch { /* storage unavailable */ } }

export function CompareButton({ id }: { id: string }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(readCompare()), []);
  const on = ids.includes(id);
  function toggle() {
    const next = on ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX_COMPARE);
    writeCompare(next); setIds(next);
  }
  return <span className="row" style={{ gap: 8 }}>
    <button className="btn btn-ghost btn-sm" onClick={toggle} aria-pressed={on}>{on ? "✓ In compare" : "Add to compare"}</button>
    {ids.length > 0 && <a className="small" href={`/compare?ids=${ids.join(",")}`}>Compare ({ids.length})</a>}
  </span>;
}
