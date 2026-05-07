"use client";

import L from "leaflet";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

const candidateIcon = L.divIcon({
  className: "custom-map-pin",
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:transparent;">
      <span style="color:#ef4444;font-size:24px;line-height:1;filter:drop-shadow(0 4px 8px rgba(15,23,42,.25));">📍</span>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -26]
});

const franchiseeIcon = L.divIcon({
  className: "custom-map-pin",
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:#0f766e;border:3px solid white;border-radius:9999px;box-shadow:0 10px 25px rgba(15,23,42,.25);">
      <span style="color:white;font-size:14px;line-height:1;">📌</span>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -26]
});

export function FranceMap({
  points
}: {
  points: Array<{ id: string; label: string; latitude: number; longitude: number; type: string; href?: string }>;
}) {
  const router = useRouter();

  return (
    <div className="h-[420px] overflow-hidden rounded-3xl border border-slate-200 shadow-soft">
      <MapContainer center={[46.6, 2.2]} zoom={5.4} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((point) => (
          <HoverableMarker key={point.id} point={point} onNavigate={(href) => router.push(href)} />
        ))}
      </MapContainer>
    </div>
  );
}

function HoverableMarker({
  point,
  onNavigate
}: {
  point: { id: string; label: string; latitude: number; longitude: number; type: string; href?: string };
  onNavigate: (href: string) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  return (
    <Marker
      ref={markerRef}
      position={[point.latitude, point.longitude]}
      icon={point.type === "Candidat" ? candidateIcon : franchiseeIcon}
      eventHandlers={{
        mouseover: () => {
          markerRef.current?.openPopup();
        },
        mouseout: () => {
          markerRef.current?.closePopup();
        },
        click: () => {
          if (point.href) {
            onNavigate(point.href);
          }
        }
      }}
    >
      <Popup closeButton={false} autoClose={false} closeOnClick={false}>
        <div className="min-w-[180px]">
          <p className="font-semibold text-slate-900">{point.label}</p>
          <p className="text-sm text-slate-500">{point.type}</p>
        </div>
      </Popup>
    </Marker>
  );
}
