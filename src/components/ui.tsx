import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";
import type { IssueCategory, IssueStatus, Priority } from "@/db/schema";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TASK_STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "outline";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-400 dark:bg-brand-500 dark:hover:bg-brand-400",
  accent: "bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-300",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900 dark:text-brand-100 dark:hover:bg-brand-800",
  outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300",
};
const SIZES = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Kept for call-site compatibility; stat cards are intentionally icon-free. */
  icon?: ReactNode;
  tone?: "brand" | "accent" | "amber" | "rose" | "emerald" | "indigo";
  href?: string;
}) {
  const body = (
    <Card className={cn("h-full px-5 py-4", href && "transition-colors hover:border-brand-300 dark:hover:border-brand-500")}>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function StatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className="text-xs text-muted">Not set</span>;
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", PRIORITY_STYLES[priority])}>{PRIORITY_LABELS[priority]}</span>;
}

export function CategoryBadge({ category }: { category: IssueCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink whitespace-nowrap">
      <span className="size-2.5 rounded-full" style={{ background: CATEGORY_COLORS[category] }} aria-hidden />
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: keyof typeof TASK_STATUS_LABELS }) {
  const style: Record<string, string> = {
    ASSIGNED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    IN_PROGRESS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    COMPLETED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    REWORK: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    CANCELLED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", style[status])}>{TASK_STATUS_LABELS[status]}</span>;
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 text-muted">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-line/70", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-accent-500", className)} aria-label="Loading" />;
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25 disabled:opacity-60 aria-[invalid=true]:border-rose-500";

/** Same look as inputClass but sized to its content (for toolbars). */
export const inputAuto = inputClass.replace("w-full ", "w-auto ");

export function Field({ label, error, hint, children, required, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const init = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-800 dark:text-brand-100" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {init}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
