"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Flame, Layers, Loader2, MapPin } from "lucide-react";
import type { IssueCategory, IssueStatus } from "@/db/schema";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, OPEN_STATUSES } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { IssueMap, type MapPoint } from ".";
import { CategoryBadge, Card, inputClass, inputAuto, StatusBadge } from "../ui";
import { MapLegend } from "./map-legend";
import { useToast } from "../toast";

type Point = MapPoint & { referenceCode: string; areaId: string | null; priority: string | null; createdAt: string };
type Nearby = { id: string; referenceCode: string; title: string; category: IssueCategory; status: IssueStatus; distance: number };

export function MapExplorer({ center, zoom, areas, defaultScope = "all", canScope }: { center: [number, number]; zoom: number; areas: { id: string; name: string; zone: string }[]; defaultScope?: "all" | "mine"; canScope?: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [category, setCategory] = useState<string>("");
  const [statusGroup, setStatusGroup] = useState<string>("open");
  const [areaId, setAreaId] = useState<string>("");
  const [scope, setScope] = useState(defaultScope);
  const [mode, setMode] = useState<"markers" | "heat" | "both">("markers");
  const [nearCenter, setNearCenter] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(800);
  const [nearby, setNearby] = useState<Nearby[] | null>(null);
  const [locating, setLocating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (statusGroup) p.set("statusGroup", statusGroup);
    if (areaId) p.set("areaId", areaId);
    p.set("scope", scope);
    const key = p.toString();
    let stale = false;
    api<{ items: Point[] }>(`/api/issues/map?${p}`)
      .then((d) => !stale && setPoints(d.items))
      .catch(() => toast({ kind: "error", title: "Could not load map data" }))
      .finally(() => !stale && setLoadedKey(key));
    return () => {
      stale = true;
    };
  }, [category, statusGroup, areaId, scope, toast]);

  const currentKey = new URLSearchParams({ ...(category && { category }), ...(statusGroup && { statusGroup }), ...(areaId && { areaId }), scope }).toString();
  const loading = loadedKey !== currentKey;

  useEffect(() => {
    if (!nearCenter) return;
    api<{ items: Nearby[] }>(`/api/issues/nearby?lat=${nearCenter[0]}&lng=${nearCenter[1]}&radius=${radius}`)
      .then((d) => setNearby(d.items))
      .catch(() => setNearby([]));
  }, [nearCenter, radius]);

  const heat = useMemo(
    () => (mode === "markers" ? null : points.filter((p) => OPEN_STATUSES.includes(p.status)).map((p) => [p.latitude, p.longitude, p.priority === "CRITICAL" ? 1 : p.priority === "HIGH" ? 0.8 : 0.5] as [number, number, number])),
    [points, mode],
  );

  const byArea = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of points) m.set(p.areaName ?? "Other", (m.get(p.areaName ?? "Other") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [points]);
  const byCat = useMemo(() => {
    const m = new Map<IssueCategory, number>();
    for (const p of points) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [points]);

  const locate = () => {
    if (!navigator.geolocation) return toast({ kind: "error", title: "Geolocation is not supported by this browser" });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setNearCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        setLocating(false);
        toast({ kind: "error", title: "Could not get your location", message: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Category</span>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Status</span>
            <select className={inputClass} value={statusGroup} onChange={(e) => setStatusGroup(e.target.value)}>
              <option value="open">Open issues</option>
              <option value="done">Resolved / closed</option>
              <option value="">All</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Area</span>
            <select className={inputClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Whole city</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.zone})</option>
              ))}
            </select>
          </label>
          {canScope && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Show</span>
              <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value as "all" | "mine")}>
                <option value="mine">{canScope}</option>
                <option value="all">All city issues</option>
              </select>
            </label>
          )}
          <div className="ml-auto flex rounded-lg border border-line p-0.5" role="group" aria-label="Map layer">
            {([
              ["markers", "Markers", MapPin],
              ["heat", "Heatmap", Flame],
              ["both", "Both", Layers],
            ] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setMode(k)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", mode === k ? "bg-brand-700 text-white dark:bg-brand-500" : "text-muted hover:text-ink")}>
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative p-3">
          {loading && (
            <div className="absolute top-6 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-surface px-3 py-1 text-xs shadow">
              <Loader2 className="mr-1 inline size-3 animate-spin" /> Loading issues…
            </div>
          )}
          <IssueMap
            points={points}
            center={center}
            zoom={zoom}
            height={560}
            showMarkers={mode !== "heat"}
            heat={heat}
            circle={nearCenter ? { center: nearCenter, radius } : null}
            pin={nearCenter}
            onMapClick={(lat, lng) => setNearCenter([lat, lng])}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <MapLegend />
            <p className="text-xs text-muted">{points.length} issues shown · click the map to find nearby issues</p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="font-semibold">Nearby issues</h2>
          <p className="mt-1 text-xs text-muted">Use your GPS location or click anywhere on the map.</p>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={locate} className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-500 px-3 text-sm font-medium text-white hover:bg-accent-600">
              {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />} Near me
            </button>
            <select className={inputAuto} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Radius">
              {[300, 500, 800, 1500, 3000].map((r) => (
                <option key={r} value={r}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</option>
              ))}
            </select>
          </div>
          {nearby && (
            <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto">
              {nearby.length === 0 && <li className="py-3 text-sm text-muted">No issues within this radius.</li>}
              {nearby.map((n) => (
                <li key={n.id} className="py-2">
                  <Link href={`/issues/${n.id}`} className="block hover:text-accent-600">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={n.status} />
                      <span className="text-xs text-muted">{n.distance} m</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold">By category</h2>
          <ul className="mt-3 space-y-2">
            {CATEGORIES.map((c) => {
              const n = byCat.get(c) ?? 0;
              const pct = points.length ? (n / points.length) * 100 : 0;
              return (
                <li key={c}>
                  <div className="flex items-center justify-between text-sm">
                    <CategoryBadge category={c} />
                    <span className="tabular-nums text-muted">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_COLORS[c] }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold">Top areas</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {byArea.map(([name, n]) => (
              <li key={name} className="flex justify-between">
                <span className="truncate">{name}</span>
                <span className="tabular-nums text-muted">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
