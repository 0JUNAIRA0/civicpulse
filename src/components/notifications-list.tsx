"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CheckCheck, ClipboardList, MessageSquare, RefreshCcw, Star, Timer } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { Button, EmptyState } from "./ui";

type N = { id: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string | Date; type: string };
const ICON: Record<string, typeof Bell> = { ISSUE_STATUS: RefreshCcw, TASK_ASSIGNED: ClipboardList, TASK_UPDATE: MessageSquare, TASK_REVIEW: CheckCheck, REMINDER: Timer, FEEDBACK: Star, SYSTEM: Bell };

export function NotificationsList({ items, unread }: { items: N[]; unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const shown = filter === "unread" ? items.filter((n) => !n.isRead) : items;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          {(["all", "unread"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1 capitalize", filter === f ? "bg-brand-700 text-white dark:bg-brand-500" : "text-muted")}>
              {f}{f === "unread" ? ` (${unread})` : ""}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!unread}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await api("/api/notifications", { method: "PATCH", json: { ids: "all" } }).catch(() => {});
            setBusy(false);
            router.refresh();
          }}
        >
          <CheckCheck className="size-4" /> Mark all as read
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={filter === "unread" ? "No unread notifications" : "No notifications yet"} icon={<Bell className="size-6" />} />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((n) => {
            const Icon = ICON[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <Link
                  href={n.link ?? "#"}
                  onClick={() => !n.isRead && api("/api/notifications", { method: "PATCH", json: { ids: [n.id] } }).catch(() => {})}
                  className={cn("flex gap-4 px-5 py-4 hover:bg-surface-2", !n.isRead && "bg-accent-50/50 dark:bg-accent-900/15")}
                >
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", n.isRead ? "bg-surface-2 text-muted" : "bg-accent-500 text-white")}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", !n.isRead && "font-semibold")}>{n.title}</p>
                    <p className="text-sm text-muted">{n.message}</p>
                    <p className="mt-1 text-xs text-muted" title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
