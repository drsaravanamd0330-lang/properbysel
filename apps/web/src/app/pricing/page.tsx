import type { Metadata } from "next";
import Link from "next/link";
import { inrExact as formatINR } from "@/lib/format";
import type { Plan } from "@pbs/api-client";
import { publicApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Pricing", description: "Post your property free. Optional featured placement and advertiser plans, with GST shown before you pay." };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  let plans: Plan[] = [];
  try { plans = (await publicApi.billing.plans()).items; } catch { /* show the free tier even if the API is down */ }
  return (
    <div className="container section">
      <h1>Pricing</h1>
      <p className="muted">Posting a property is free. Paid options are optional and never change how we moderate listings.</p>
      <div className="grid-cards" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 16 }}>
        <div className="card card-pad"><h2 style={{ marginTop: 0 }}>Free listing</h2><p className="price" style={{ fontSize: 24, fontWeight: 700 }}>₹0</p><p>Post a property, receive enquiries, chat with buyers and tenants. Listings stay live for 90 days and can be renewed.</p><Link className="btn btn-primary" href="/post-property">Post property</Link></div>
        {plans.map((p) => (
          <div key={p.code} className="card card-pad">
            <h2 style={{ marginTop: 0 }}>{p.name}</h2>
            <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>{formatINR(p.pricePaise)}</p>
            <p className="small muted">+ GST {p.gstRateBps / 100}% ({formatINR(p.taxPaise)}) = {formatINR(p.totalPaise)}</p>
            <p>{p.description}</p>
            {p.kind === "FEATURED_LISTING" && <p className="small muted">Choose “Feature” next to a live listing in My listings.</p>}
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 24 }}>Payments are for advertising services only. ProperBySel never collects property deposits, advance rent or sale consideration. See the <Link href="/refunds">refund policy</Link>.</p>
    </div>
  );
}
