"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { headlinePrice, statusLabel, categoryLabel, fmtDateTime } from "@/lib/format";

function Queue() {
  const status = useSearchParams().get("status") ?? "PENDING_REVIEW";
  const { data, error, loading, reload } = useApi(() => api.admin.queue(status), [status]);
  return (
    <div className="stack">
      <h1>{statusLabel(status)} {data && <span className="badge">{data.total}</span>}</h1>
      {loading && <Loading />}{error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card">Nothing here. The queue is clear.</div>}
      {data && data.items.length > 0 && <div className="table-wrap card"><table className="table">
        <thead><tr><th>Listing</th><th>Advertiser</th><th>Submitted</th><th></th></tr></thead>
        <tbody>{data.items.map((l) => <tr key={l.id}>
          <td><b>{l.title}</b><div className="small muted">{categoryLabel(l.category)} · {headlinePrice(l)} · {l.locality?.name}, {l.city?.name} · {l.media.length} photos</div></td>
          <td className="small">{l.advertiserName} ({l.advertiserType})<div className="muted">{l.ownerPhone}</div></td>
          <td className="small">{l.submittedAt ? fmtDateTime(l.submittedAt) : "—"}</td>
          <td><Link className="btn btn-navy btn-sm" href={`/admin/listings/${l.id}`}>Review</Link></td>
        </tr>)}</tbody></table></div>}
    </div>
  );
}
export default function AdminHome() { return <Suspense><Queue /></Suspense>; }
