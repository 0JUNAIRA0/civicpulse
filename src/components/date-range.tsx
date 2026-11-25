"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { inputAuto } from "./ui";
import { cn, daysAgoIso } from "@/lib/utils";

const PRESETS = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "6 months", days: 182 },
  { label: "12 months", days: 365 },
];

/** Date range filter for dashboards; keeps state in the URL. */
export function DateRangeFilter({ extra }: { extra?: React.ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    start(() => router.replace(`${path}?${n}`, { scroll: false }));
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex rounded-lg border border-line bg-surface p-0.5">
        <button onClick={() => set({ from: null, to: null })} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", !from && !to ? "bg-brand-700 text-white dark:bg-brand-500" : "text-muted hover:text-ink")}>
          All time
        </button>
        {PRESETS.map((p) => {
          const f = daysAgoIso(p.days);
          const active = from === f && !to;
          return (
            <button key={p.label} onClick={() => set({ from: f, to: null })} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", active ? "bg-brand-700 text-white dark:bg-brand-500" : "text-muted hover:text-ink")}>
              {p.label}
            </button>
          );
        })}
      </div>
      <input type="date" aria-label="From date" className={inputAuto + " h-9 py-1"} value={from} max={to || undefined} onChange={(e) => set({ from: e.target.value || null })} />
      <span className="pb-2 text-xs text-muted">to</span>
      <input type="date" aria-label="To date" className={inputAuto + " h-9 py-1"} value={to} min={from || undefined} onChange={(e) => set({ to: e.target.value || null })} />
      {extra}
      {pending && <Loader2 className="mb-2 size-4 animate-spin text-accent-500" />}
    </div>
  );
}
