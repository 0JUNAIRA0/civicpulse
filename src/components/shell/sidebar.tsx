"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, BarChart3, Building2, Home, List, Map, Menu, Plus, Settings, User, Users, Wrench, X } from "lucide-react";
import type { NavItem } from "./nav";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

const ICONS = { home: Home, plus: Plus, list: List, map: Map, bell: Bell, user: User, wrench: Wrench, users: Users, chart: BarChart3, building: Building2, settings: Settings };

function Links({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((it) => {
        const Icon = ICONS[it.icon as keyof typeof ICONS] ?? Home;
        const active = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-brand-50 font-medium text-brand-700 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-500 dark:bg-white/5 dark:text-white"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
      <Link href="/dashboard" className="flex h-8 items-center px-3">
        <Logo />
      </Link>
      <p className="mt-6 mb-1.5 px-3 text-xs text-muted">{roleLabel}</p>
      <Links items={items} />
    </aside>
  );
}

export function MobileNav({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="grid size-9 place-items-center rounded-lg text-ink hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="animate-slide-in absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-line bg-surface px-3 py-4">
            <div className="flex items-center justify-between px-3">
              <Logo />
              <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-6 mb-1.5 px-3 text-xs text-muted">{roleLabel}</p>
            <Links items={items} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
