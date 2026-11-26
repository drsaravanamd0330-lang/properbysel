import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES } from "./content";

export function generateStaticParams() { return Object.keys(PAGES).map((page) => ({ page })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const p = PAGES[(await params).page];
  return p ? { title: p.title, robots: p.draft ? { index: false } : undefined } : {};
}

export default async function InfoPage({ params }: { params: Promise<{ page: string }> }) {
  const p = PAGES[(await params).page];
  if (!p) notFound();
  return (
    <div className="container section prose">
      {p.draft && <div className="draft-banner" role="note">Draft for professional review. Not final legal text.</div>}
      <h1>{p.title}</h1>
      {p.body.map((para, i) => <p key={i}>{para}</p>)}
    </div>
  );
}
