import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/Wizard";
export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };
export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  return <div className="container"><Wizard id={(await params).id} /></div>;
}
