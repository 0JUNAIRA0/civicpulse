import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function hrefWith(base: string, params: Record<string, string | undefined>, patch: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

export function Pagination({ base, params, page, totalPages, total, pageSize }: { base: string; params: Record<string, string | undefined>; page: number; totalPages: number; total: number; pageSize: number }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const item = "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-ink">{from}</span>–<span className="font-medium text-ink">{to}</span> of <span className="font-medium text-ink">{total}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        {page > 1 ? (
          <Link href={hrefWith(base, params, { page: page - 1 })} className={cn(item, "hover:bg-surface-2")} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={cn(item, "opacity-40")}><ChevronLeft className="size-4" /></span>
        )}
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className={cn(item, "text-muted")}>…</span>
          ) : (
            <Link key={p} href={hrefWith(base, params, { page: p })} aria-current={p === page ? "page" : undefined} className={cn(item, p === page ? "bg-brand-700 font-semibold text-white dark:bg-brand-500" : "hover:bg-surface-2")}>
              {p}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link href={hrefWith(base, params, { page: page + 1 })} className={cn(item, "hover:bg-surface-2")} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(item, "opacity-40")}><ChevronRight className="size-4" /></span>
        )}
      </nav>
    </div>
  );
}
