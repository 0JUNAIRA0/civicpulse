"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Filter, Loader2, Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_LABELS, PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "@/lib/constants";
import { inputClass, inputAuto } from "../ui";
import { useDebounce } from "../use-debounce";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string };

/** URL-driven filters: every change updates the query string and the server re-renders the list. */
export function IssueFilters({ departments, areas, show = {} }: { departments?: Opt[]; areas?: Opt[]; show?: { department?: boolean; area?: boolean } }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const debounced = useDebounce(q, 400);
  const [open, setOpen] = useState(false);
  const first = useRef(true);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if ((sp.get("q") ?? "") !== debounced) update({ q: debounced || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const sel = (name: string, label: string, options: { value: string; label: string }[]) => (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <select className={inputClass} value={sp.get(name) ?? ""} onChange={(e) => update({ [name]: e.target.value || null })}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const activeCount = ["status", "category", "priority", "departmentId", "areaId", "from", "to", "statusGroup"].filter((k) => sp.get(k)).length;

  return (
    <div className="space-y-3 border-b border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, address or reference (e.g. CP-2026-01020)…" className={inputClass + " pl-9"} aria-label="Search issues" />
          {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-accent-500" />}
        </div>
        <button onClick={() => setOpen((o) => !o)} className={cn("inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2", activeCount > 0 && "border-accent-400 text-accent-700 dark:text-accent-300")} aria-expanded={open}>
          <Filter className="size-4" /> Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
        <label className="inline-flex items-center gap-2 text-sm">
          <span className="text-muted">Sort</span>
          <select
            className={inputAuto}
            value={`${sp.get("sort") ?? "createdAt"}:${sp.get("order") ?? "desc"}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(":");
              update({ sort, order });
            }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="updatedAt:desc">Recently updated</option>
            <option value="priority:desc">Priority (high → low)</option>
            <option value="priority:asc">Priority (low → high)</option>
            <option value="status:asc">Status (workflow order)</option>
            <option value="title:asc">Title A–Z</option>
          </select>
        </label>
        {(activeCount > 0 || q) && (
          <button
            onClick={() => {
              setQ("");
              start(() => router.replace(pathname, { scroll: false }));
            }}
            className="inline-flex h-10 items-center gap-1 px-2 text-sm text-muted hover:text-ink"
          >
            <X className="size-4" /> Clear
          </button>
        )}
      </div>
      {open && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sel(
            "status",
            "Status",
            STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          )}
          {sel(
            "category",
            "Category",
            CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
          )}
          {sel("priority", "Priority", [...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })), { value: "NONE", label: "Not set" }])}
          {show.department && departments && sel("departmentId", "Department", departments.map((d) => ({ value: d.id, label: d.name })))}
          {show.area && areas && sel("areaId", "Area", areas.map((a) => ({ value: a.id, label: a.name })))}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Reported from</span>
            <input type="date" className={inputClass} value={sp.get("from") ?? ""} max={sp.get("to") ?? undefined} onChange={(e) => update({ from: e.target.value || null })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Reported to</span>
            <input type="date" className={inputClass} value={sp.get("to") ?? ""} min={sp.get("from") ?? undefined} onChange={(e) => update({ to: e.target.value || null })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Rows per page</span>
            <select className={inputClass} value={sp.get("pageSize") ?? "10"} onChange={(e) => update({ pageSize: e.target.value })}>
              {[10, 20, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
