"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { PublicListing } from "@pbs/api-client";
import { headlinePrice } from "@/lib/format";

/** Shows approximate locations only (rounded ~1 km), never exact addresses. */
export default function ResultsMap({ items }: { items: PublicListing[] }) {
  const pts = items.filter((l) => l.approxLat && l.approxLng);
  const center: [number, number] = pts.length ? [pts[0]!.approxLat!, pts[0]!.approxLng!] : [13.0827, 80.2707];
  return (
    <div className="map" aria-label="Map of approximate listing locations">
      <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pts.map((l) => (
          <CircleMarker key={l.id} center={[l.approxLat!, l.approxLng!]} radius={10} pathOptions={{ color: "#0B2545", fillColor: "#1FB58F", fillOpacity: 0.85 }}>
            <Popup><strong>{headlinePrice(l)}</strong><br /><a href={l.path}>{l.title}</a><br /><small>Approximate area</small></Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
