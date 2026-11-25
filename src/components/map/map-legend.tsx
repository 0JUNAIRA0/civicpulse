import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/constants";

export function MapLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {CATEGORIES.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className="size-3 rounded-full" style={{ background: CATEGORY_COLORS[c] }} /> {CATEGORY_LABELS[c]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <span className="size-3 rounded-full bg-slate-400 opacity-55" /> Faded = resolved
      </span>
    </div>
  );
}
