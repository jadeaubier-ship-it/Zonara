"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";

const MapContainer = dynamic(async () => (await import("react-leaflet")).MapContainer, { ssr: false });
const Marker = dynamic(async () => (await import("react-leaflet")).Marker, { ssr: false });
const TileLayer = dynamic(async () => (await import("react-leaflet")).TileLayer, { ssr: false });
const UseMapBridge = dynamic(
  async () => {
    const { useMap } = await import("react-leaflet");

    return function UseMapBridgeComponent() {
      const map = useMap();

      useEffect(() => {
        const timeout = window.setTimeout(() => {
          map.invalidateSize();
        }, 80);

        return () => window.clearTimeout(timeout);
      }, [map]);

      return null;
    };
  },
  { ssr: false }
);

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
  const candidateIcon = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const L = require("leaflet");
    return L.divIcon({
      className: "custom-map-pin",
      html: `
        <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:transparent;">
          <span style="color:#ef4444;font-size:22px;line-height:1;filter:drop-shadow(0 4px 8px rgba(15,23,42,.25));">📍</span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 26]
    });
  }, []);

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
          <UseMapBridge />
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {candidateIcon ? <Marker position={[latitude, longitude]} icon={candidateIcon} /> : null}
        </MapContainer>
      </div>
    </div>
  );
}
