"use client";

import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

const candidateIcon = L.divIcon({
  className: "custom-map-pin",
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:transparent;">
      <span style="color:#ef4444;font-size:22px;line-height:1;filter:drop-shadow(0 4px 8px rgba(15,23,42,.25));">📍</span>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 26]
});

export function CandidateMiniMap({
  latitude,
  longitude,
  cityLabel,
  zoom = 5
}: {
  latitude?: number | null;
  longitude?: number | null;
  cityLabel?: string;
  zoom?: number;
}) {
  if (!latitude || !longitude) {
    return (
      <div className="flex h-full min-h-[14rem] flex-col">
        {cityLabel ? <p className="px-4 pt-4 text-base font-bold text-slate-950">{cityLabel}</p> : null}
        <div className="mt-3 flex flex-1 items-center justify-center bg-slate-50 text-sm text-slate-400">
          Localisation non disponible
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[14rem] flex-col">
      {cityLabel ? <p className="px-4 pt-4 text-base font-bold text-slate-950">{cityLabel}</p> : null}
      <div className="mt-3 flex-1 overflow-hidden">
        <MapContainer center={[46.603354, 1.888334]} zoom={zoom} scrollWheelZoom={false} dragging={false} zoomControl={false} doubleClickZoom={false} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[latitude, longitude]} icon={candidateIcon} />
        </MapContainer>
      </div>
    </div>
  );
}
