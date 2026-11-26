import Link from "next/link";
import type { PublicListing } from "@pbs/api-client";
import { headlinePrice, categoryLabel, advertiserLabel, areaLabel, txLabel } from "@/lib/format";

export function ListingCard({ l }: { l: PublicListing }) {
  const img = l.media[0];
  const beds = l.bedrooms ? `${l.bedrooms} BHK · ` : "";
  return (
    <Link href={l.path} className="card lcard">
      {img ? <img className="thumb" src={img.url} alt="" loading="lazy" width={600} height={400} /> : <div className="thumb" aria-hidden />}
      <div className="body">
        <div className="row" style={{ gap: 6 }}>
          {l.isSponsored && <span className="badge badge-sponsored">Sponsored</span>}
          {l.isDemo && <span className="badge badge-demo">Demo</span>}
          <span className="badge">{txLabel(l.transaction)}</span>
        </div>
        <div className="price">{headlinePrice(l)}</div>
        <div className="title">{l.title}</div>
        <div className="small muted">{beds}{categoryLabel(l.category)}{areaLabel(l) ? ` · ${areaLabel(l)}` : ""}</div>
        <div className="small muted">{[l.locality?.name, l.city?.name].filter(Boolean).join(", ")}</div>
        <div className="small"><span className="muted">Posted by</span> {advertiserLabel(l.advertiserType)}</div>
      </div>
    </Link>
  );
}
