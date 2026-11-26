"use client";
import dynamic from "next/dynamic";
import type { PublicListing } from "@pbs/api-client";

const ResultsMap = dynamic(() => import("./ResultsMap"), { ssr: false, loading: () => <div className="map skeleton" aria-busy="true" /> });
export function MapView({ items }: { items: PublicListing[] }) { return <ResultsMap items={items} />; }
