"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Avatar } from "../ui";

export function UserMenu({ name, email, roleLabel, avatarUrl }: { name: string; email: string; roleLabel: string; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-2" aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={name} src={avatarUrl} size={32} />
        <span className="hidden text-left sm:block">
          <span className="block max-w-36 truncate text-sm leading-tight font-medium">{name}</span>
          <span className="block text-[11px] leading-tight text-muted">{roleLabel}</span>
        </span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="animate-slide-in absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-md" role="menu">
          <div className="border-b border-line px-4 py-2.5">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surface-2" role="menuitem">
            <User className="size-4" /> Profile settings
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-surface-2" role="menuitem">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
