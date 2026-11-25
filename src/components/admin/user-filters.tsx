"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { inputClass, inputAuto } from "../ui";
import { useDebounce } from "../use-debounce";

export function UserFilters({ departments }: { departments: { id: string; name: string }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounce(q, 400);
  const first = useRef(true);
  const update = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    n.delete("page");
    start(() => router.replace(`${path}?${n}`, { scroll: false }));
  };
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    update({ q: dq || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input className={inputClass + " pl-9"} placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-accent-500" />}
      </div>
      <select className={inputAuto} value={sp.get("role") ?? ""} onChange={(e) => update({ role: e.target.value || null })} aria-label="Role">
        <option value="">All roles</option>
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      <select className={inputAuto} value={sp.get("departmentId") ?? ""} onChange={(e) => update({ departmentId: e.target.value || null })} aria-label="Department">
        <option value="">All departments</option>
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <select className={inputAuto} value={sp.get("status") ?? ""} onChange={(e) => update({ status: e.target.value || null })} aria-label="Status">
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select className={inputAuto} value={`${sp.get("sort") ?? "createdAt"}:${sp.get("order") ?? "desc"}`} onChange={(e) => { const [sort, order] = e.target.value.split(":"); update({ sort, order }); }} aria-label="Sort">
        <option value="createdAt:desc">Newest</option>
        <option value="name:asc">Name A–Z</option>
        <option value="role:asc">Role</option>
        <option value="lastLoginAt:desc">Last active</option>
      </select>
    </div>
  );
}
