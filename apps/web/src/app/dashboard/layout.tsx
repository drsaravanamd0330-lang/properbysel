import type { Metadata } from "next";
import { DashNav } from "./DashNav";
export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return <div className="container dash"><DashNav /><div>{children}</div></div>;
}
