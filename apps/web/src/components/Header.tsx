import Link from "next/link";
import { cookies } from "next/headers";
import { BRAND } from "@/lib/config";
import { AccountMenu } from "./AccountMenu";

export async function Header() {
  const c = await cookies();
  const signedIn = !!c.get("pbs_rt") || !!c.get("pbs_at") || !!c.get("pbs_roles")?.value;
  const roles = (c.get("pbs_roles")?.value ?? "").split(",");
  const isStaff = roles.includes("MODERATOR") || roles.includes("ADMIN");
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand" aria-label={`${BRAND.name} home`}>
          <img src="/brand/mark.svg" alt="" width={36} height={36} />
          <div><strong>{BRAND.name}</strong><span>{BRAND.tagline}</span></div>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/search?transaction=RENT">Rent</Link>
          <Link href="/search?transaction=SALE">Buy</Link>
          <Link href="/post-property">Sell</Link>
        </nav>
        <div className="spacer" />
        <Link href="/post-property" className="btn btn-primary btn-sm">Post Property <span className="badge" style={{ background: "#fff", color: "var(--emerald-700)" }}>Free</span></Link>
        <AccountMenu signedIn={signedIn} isStaff={isStaff} />
      </div>
    </header>
  );
}
