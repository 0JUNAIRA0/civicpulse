"use client";
import Link from "next/link";
import { useEffect } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { IssueCategory, IssueStatus } from "@/db/schema";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { categoryIcon, loadHeat, pinIcon, TILE_ATTR, TILE_URL } from "./leaflet-utils";

export type MapPoint = {
  id: string;
  referenceCode?: string;
  title: string;
  category: IssueCategory;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  areaName?: string | null;
};

export type IssueMapProps = {
  points: MapPoint[];
  center: [number, number];
  zoom?: number;
  height?: number | string;
  showMarkers?: boolean;
  heat?: [number, number, number][] | null;
  circle?: { center: [number, number]; radius: number } | null;
  pin?: [number, number] | null;
  fit?: boolean;
  highlightId?: string;
  onMapClick?: (lat: number, lng: number) => void;
  linkable?: boolean;
};

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    let layer: L.Layer | null = null;
    let cancelled = false;
    loadHeat().then(() => {
      if (cancelled) return;
      // The plugin registers itself on the global `L`, which may be a different object from the ESM import.
      type HeatFn = (p: [number, number, number][], o: object) => L.Layer;
      const heatLayer = ((window as unknown as { L?: { heatLayer?: HeatFn } }).L?.heatLayer ?? (L as unknown as { heatLayer?: HeatFn }).heatLayer) as HeatFn | undefined;
      if (!heatLayer) return;
      layer = heatLayer(points, { radius: 28, blur: 22, maxZoom: 15, minOpacity: 0.35, gradient: { 0.2: "#00A6A6", 0.5: "#E8A400", 0.8: "#D9480F", 1: "#C92A2A" } });
      layer.addTo(map);
    });
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude])), { padding: [30, 30], maxZoom: 15 });
    else if (points.length === 1) map.setView([points[0].latitude, points[0].longitude], 15);
  }, [map, points]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(center);
  }, [map, center]);
  return null;
}

export default function IssueMapInner({ points, center, zoom = 12, height = 420, showMarkers = true, heat, circle, pin, fit, highlightId, onMapClick, linkable = true }: IssueMapProps) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height, width: "100%" }} className="rounded-lg">
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      {fit && <FitBounds points={points} />}
      {circle && <Recenter center={circle.center} />}
      {onMapClick && <ClickHandler onClick={onMapClick} />}
      {heat && heat.length > 0 && <HeatLayer points={heat} />}
      {circle && <Circle center={circle.center} radius={circle.radius} pathOptions={{ color: "#00A6A6", fillColor: "#00A6A6", fillOpacity: 0.08, weight: 2 }} />}
      {pin && <Marker position={pin} icon={pinIcon} />}
      {showMarkers &&
        points.map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={categoryIcon(p.category, { dim: ["RESOLVED", "CLOSED"].includes(p.status), big: p.id === highlightId })}>
            <Popup>
              <div className="min-w-48 space-y-1">
                {p.referenceCode && <p className="font-mono text-[11px] text-slate-500">{p.referenceCode}</p>}
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-xs">
                  {CATEGORY_LABELS[p.category]} · {STATUS_LABELS[p.status]}
                </p>
                {p.areaName && <p className="text-xs text-slate-500">{p.areaName}</p>}
                {linkable && (
                  <Link href={`/issues/${p.id}`} className="inline-block pt-1 text-xs font-semibold text-[#00A6A6]">
                    Open details →
                  </Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
