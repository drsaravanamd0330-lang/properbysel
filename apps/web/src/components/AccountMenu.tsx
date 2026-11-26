"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountMenu({ signedIn, isStaff }: { signedIn: boolean; isStaff: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!signedIn) return <Link href="/login" className="btn btn-ghost on-dark btn-sm">Log in</Link>;
  return (
    <div className="row" style={{ gap: 6 }}>
      {isStaff && <Link href="/admin" className="btn btn-ghost on-dark btn-sm hide-sm">Admin</Link>}
      <Link href="/dashboard" className="btn btn-ghost on-dark btn-sm">Account</Link>
      <button className="btn btn-ghost on-dark btn-sm hide-sm" disabled={busy} onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/"); router.refresh();
      }}>Log out</button>
    </div>
  );
}
