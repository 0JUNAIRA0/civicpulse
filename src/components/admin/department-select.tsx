"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { inputAuto } from "../ui";

export function DepartmentSelect({ departments }: { departments: { id: string; name: string }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  return (
    <select
      aria-label="Department"
      className={inputAuto + " h-9 py-1"}
      value={sp.get("departmentId") ?? ""}
      onChange={(e) => {
        const n = new URLSearchParams(sp.toString());
        if (e.target.value) n.set("departmentId", e.target.value);
        else n.delete("departmentId");
        router.replace(`${path}?${n}`, { scroll: false });
      }}
    >
      <option value="">All departments</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );
}
