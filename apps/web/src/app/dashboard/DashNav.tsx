"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const LINKS = [["/dashboard", "My listings"], ["/dashboard/inbox", "Leads inbox"], ["/dashboard/enquiries", "My enquiries"], ["/dashboard/favourites", "Saved properties"], ["/dashboard/notifications", "Notifications"], ["/dashboard/profile", "Profile"]] as const;
export function DashNav() {
  const p = usePathname();
  return <nav className="dash-nav card card-pad" aria-label="Account">{LINKS.map(([href, label]) => <Link key={href} href={href} aria-current={p === href ? "page" : undefined}>{label}</Link>)}<Link href="/post-property" className="btn btn-primary btn-sm" style={{ marginTop: 10, color: "#fff" }}>Post property</Link><button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: "100%" }} onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>Log out</button></nav>;
}
