"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn, timeAgo } from "@/lib/utils";
import { useToast } from "../toast";

type N = { id: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string; type: string };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ items: N[]; unread: number }>("/api/notifications?limit=8");
      setItems(d.items);
      setUnread(d.unread);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time updates over Server-Sent Events.
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("unread", (e) => setUnread(JSON.parse((e as MessageEvent).data).unread));
    es.addEventListener("notification", (e) => {
      const n = JSON.parse((e as MessageEvent).data) as N;
      setItems((all) => [n, ...all.filter((x) => x.id !== n.id)].slice(0, 8));
      toast({ kind: "info", title: n.title, message: n.message });
      router.refresh();
    });
    return () => es.close();
  }, [toast, router]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await api("/api/notifications", { method: "PATCH", json: { ids: "all" } });
    setItems((all) => all.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };
  const markOne = async (n: N) => {
    if (!n.isRead) {
      setItems((all) => all.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api("/api/notifications", { method: "PATCH", json: { ids: [n.id] } }).catch(() => {});
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="animate-slide-in absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface shadow-md">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline disabled:opacity-50" disabled={!unread}>
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && !items.length ? (
              <p className="p-6 text-center text-sm text-muted">Loading…</p>
            ) : !items.length ? (
              <p className="p-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <Link key={n.id} href={n.link ?? "/notifications"} onClick={() => markOne(n)} className={cn("block border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2", !n.isRead && "bg-accent-50/60 dark:bg-accent-900/20")}>
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-500" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-muted">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-surface-2 dark:text-brand-200">
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
