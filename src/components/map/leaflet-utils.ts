"use client";
import L from "leaflet";
import type { IssueCategory } from "@/db/schema";
import { CATEGORY_COLORS } from "@/lib/constants";

const ABBR: Record<IssueCategory, string> = {
  ROAD_DAMAGE: "R",
  STREETLIGHT: "L",
  DRAINAGE: "D",
  FOOTPATH: "F",
  WASTE_MANAGEMENT: "W",
  PUBLIC_INFRASTRUCTURE: "P",
};

const cache = new Map<string, L.DivIcon>();
export function categoryIcon(category: IssueCategory, opts: { dim?: boolean; big?: boolean } = {}) {
  const key = `${category}-${opts.dim}-${opts.big}`;
  if (!cache.has(key)) {
    const size = opts.big ? 34 : 26;
    cache.set(
      key,
      L.divIcon({
        className: "",
        html: `<div class="cp-marker" style="width:${size}px;height:${size}px;background:${CATEGORY_COLORS[category]};opacity:${opts.dim ? 0.55 : 1}"><span>${ABBR[category]}</span></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      }),
    );
  }
  return cache.get(key)!;
}

export const pinIcon = L.divIcon({
  className: "",
  html: `<div class="cp-marker" style="width:36px;height:36px;background:#123B5D;border-color:#00A6A6;border-width:3px"><span>●</span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

let heatLoaded: Promise<unknown> | null = null;
/** leaflet.heat is a classic plugin that expects a global `L`. */
export function loadHeat() {
  if (!heatLoaded) {
    (window as unknown as { L: typeof L }).L = L;
    heatLoaded = import("leaflet.heat");
  }
  return heatLoaded;
}
