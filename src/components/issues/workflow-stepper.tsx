import { Check, X } from "lucide-react";
import type { IssueStatus } from "@/db/schema";
import { STATUS_LABELS, WORKFLOW } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

export function WorkflowStepper({ status, history }: { status: IssueStatus; history: { toStatus: IssueStatus; createdAt: Date }[] }) {
  if (status === "REJECTED") {
    const at = [...history].reverse().find((h) => h.toStatus === "REJECTED")?.createdAt;
    return (
      <div className="flex items-center gap-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
        <X className="size-5" /> This report was closed without action{at ? ` on ${formatDate(at)}` : ""}.
      </div>
    );
  }
  const idx = WORKFLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-6 gap-1">
      {WORKFLOW.map((s, i) => {
        const done = i < idx || (i === idx && status === "CLOSED");
        const current = i === idx && status !== "CLOSED";
        const at = [...history].reverse().find((h) => h.toStatus === s)?.createdAt;
        return (
          <li key={s} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : i <= idx ? "bg-accent-500" : "bg-line")} />
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold", done ? "border-accent-500 bg-accent-500 text-white" : current ? "border-accent-500 bg-surface text-accent-600 ring-4 ring-accent-500/20" : "border-line bg-surface text-muted")}>
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", i === WORKFLOW.length - 1 ? "opacity-0" : i < idx ? "bg-accent-500" : "bg-line")} />
            </div>
            <p className={cn("mt-1.5 text-[11px] leading-tight font-medium sm:text-xs", current ? "text-accent-700 dark:text-accent-300" : done ? "text-ink" : "text-muted")}>{STATUS_LABELS[s]}</p>
            {at && i <= idx && <p className="hidden text-[10px] text-muted sm:block">{formatDate(at, { year: undefined })}</p>}
          </li>
        );
      })}
    </ol>
  );
}
