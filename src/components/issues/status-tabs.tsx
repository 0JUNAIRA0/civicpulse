import Link from "next/link";
import { cn } from "@/lib/utils";
import { hrefWith } from "../pagination";

export function StatusTabs({ base, params, tabs }: { base: string; params: Record<string, string | undefined>; tabs: { label: string; patch: Record<string, string | undefined>; count?: number }[] }) {
  const isActive = (patch: Record<string, string | undefined>) =>
    ["status", "statusGroup"].every((k) => (params[k] ?? undefined) === (patch[k] ?? undefined));
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line px-3">
      {tabs.map((t) => {
        const active = isActive(t.patch);
        return (
          <Link
            key={t.label}
            href={hrefWith(base, { ...params, status: undefined, statusGroup: undefined, page: undefined }, t.patch)}
            className={cn("-mb-px border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap", active ? "border-accent-500 text-accent-700 dark:text-accent-300" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
            {t.count != null && <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200" : "bg-surface-2")}>{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
