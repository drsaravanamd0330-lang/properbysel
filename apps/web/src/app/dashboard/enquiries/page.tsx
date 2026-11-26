"use client";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { useApi, Loading, ErrorBox } from "@/components/useApi";
import { headlinePrice, fmtDate } from "@/lib/format";

export default function MyEnquiries() {
  const { data, error, loading, reload } = useApi(() => api.me.enquiries());
  return (
    <div className="stack"><h1>My enquiries</h1>
      {loading && <Loading />}{error && <ErrorBox error={error} retry={reload} />}
      {data && data.items.length === 0 && <div className="empty card">You have not contacted any advertisers yet. <Link href="/search">Search properties</Link></div>}
      {data?.items.map((e) => <div key={e.id} className="card card-pad row">
        <div><b>{e.listing.title}</b><div className="small muted">{headlinePrice(e.listing)} · sent {fmtDate(e.createdAt)}</div></div><div className="spacer" />
        <Link className="btn btn-ghost btn-sm" href={`/dashboard/messages/${e.conversationId}`}>Open conversation</Link></div>)}
    </div>
  );
}
