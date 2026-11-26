import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="container" style={{ padding: "20px 16px 48px" }}>
    <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}><b>Moderation</b><Link href="/admin">Review queue</Link><Link href="/admin?status=CHANGES_REQUESTED">Changes requested</Link><Link href="/admin?status=PUBLISHED">Published</Link><Link href="/admin?status=REJECTED">Rejected</Link><Link href="/admin/reports">Reports</Link><Link href="/admin/users">Users</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/audit">Audit log</Link><Link href="/admin/metrics">Metrics</Link></div>
    <div className="alert alert-info small">Access to these pages is enforced by the API: only moderator and admin accounts can load data here.</div>
    {children}
  </div>;
}
