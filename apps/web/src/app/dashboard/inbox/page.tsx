"use client";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDateTime, statusLabel } from "@/lib/format";

export default function Inbox() {
  const { data, error, loading, reload } = useApi(() => api.me.inbox());
  return (
    <div className="stack">
      <h1>Leads inbox</h1>
      <p className="muted small">Enquiries from people interested in your listings.</p>
      {loading && <Loading />}{error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card">No enquiries yet. Listings with good photos and complete details get more responses.</div>}
      {data && data.items.length > 0 && <div className="table-wrap card"><table className="table">
        <thead><tr><th></th><th>From</th><th>Property</th><th>Last message</th><th>Stage</th></tr></thead>
        <tbody>{data.items.map((e) => <tr key={e.id}>
          <td>{e.unread && <span className="unread-dot" aria-label="Unread" />}</td>
          <td><Link href={`/dashboard/messages/${e.conversationId}`}><b>{e.buyer.name}</b></Link>{e.buyer.phone && <div className="small">{e.buyer.phone}</div>}</td>
          <td className="small">{e.listing.title}</td>
          <td className="small">{e.lastMessage ? <>{e.lastMessage.fromMe ? "You: " : ""}{e.lastMessage.body.slice(0, 80)}<div className="muted">{fmtDateTime(e.lastMessage.at)}</div></> : "—"}</td>
          <td><span className="badge">{statusLabel(e.stage)}</span></td>
        </tr>)}</tbody></table></div>}
    </div>
  );
}
