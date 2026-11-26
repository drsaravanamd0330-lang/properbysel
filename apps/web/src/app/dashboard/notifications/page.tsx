"use client";
import Link from "next/link";
import { useEffect } from "react";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { fmtDateTime } from "@/lib/format";

export default function Notifications() {
  const { data, error, loading, reload } = useApi(() => api.me.notifications());
  useEffect(() => { if (data?.unread) api.me.markNotificationsRead().catch(() => undefined); }, [data?.unread]);
  return (
    <div className="stack"><h1>Notifications</h1>
      {loading && <Loading />}{error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card">No notifications yet.</div>}
      {data?.items.map((n) => <div key={n.id} className="card card-pad"><div className="row">{!n.readAt && <span className="unread-dot" aria-label="New" />}<b>{n.title}</b><div className="spacer" /><span className="small muted">{fmtDateTime(n.createdAt)}</span></div>
        <p className="small" style={{ margin: "4px 0" }}>{n.body}</p>{n.link && <Link className="small" href={n.link.replace("/dashboard/listings/", "/post-property/").replace(/\/dashboard\/inbox\/.*/, "/dashboard/inbox")}>Open</Link>}</div>)}
    </div>
  );
}
