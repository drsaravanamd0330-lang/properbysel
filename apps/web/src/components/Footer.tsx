import Link from "next/link";
import { BRAND } from "@/lib/config";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="row"><img src="/brand/mark.svg" alt="" width={32} height={32} /><strong style={{ color: "#fff", fontSize: "1.1rem" }}>{BRAND.name}</strong></div>
            <p className="small" style={{ marginTop: 8 }}>{BRAND.positioning}<br />{BRAND.secondary}</p>
            <p className="small">{BRAND.ownership}</p>
          </div>
          <div><h3 style={{ color: "#fff" }}>Explore</h3><ul>
            <li><Link href="/search?transaction=RENT&city=chennai">Rent in Chennai</Link></li>
            <li><Link href="/search?transaction=SALE&city=chennai">Buy in Chennai</Link></li>
            <li><Link href="/post-property">Post property</Link></li>
            <li><Link href="/pricing">Pricing</Link></li>
          </ul></div>
          <div><h3 style={{ color: "#fff" }}>Help &amp; trust</h3><ul>
            <li><Link href="/help">Help centre</Link></li>
            <li><Link href="/safety">Safety tips</Link></li>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul></div>
          <div><h3 style={{ color: "#fff" }}>Policies</h3><ul>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms of use</Link></li>
            <li><Link href="/refunds">Refunds &amp; cancellation</Link></li>
            <li><Link href="/grievance">Grievance redressal</Link></li>
          </ul></div>
        </div>
        <p className="small" style={{ marginTop: 24, borderTop: "1px solid var(--navy-700)", paddingTop: 12 }}>
          © {new Date().getFullYear()} {BRAND.name}. Listings are posted by advertisers; ProperBySel does not verify legal title. Check documents independently before paying anyone.
        </p>
      </div>
    </footer>
  );
}
