import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, users } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { listDepartments } from "@/server/services/departments";
import { CATEGORY_LABELS } from "@/lib/constants";
import { Card, PageHeader } from "@/components/ui";
import { DepartmentActiveToggle, DepartmentFormButton } from "@/components/admin/department-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  await requirePageUser(["ADMIN"]);
  const [rows, managers] = await Promise.all([
    listDepartments({ includeInactive: true }),
    db.select({ id: users.id, name: users.name, departmentName: departments.name }).from(users).leftJoin(departments, eq(departments.id, users.departmentId)).where(and(eq(users.role, "DEPT_MANAGER"), eq(users.isActive, true))).orderBy(asc(users.name)),
  ]);
  return (
    <>
      <PageHeader title="Departments" description="Create, update and deactivate departments; assign managers and routing categories." actions={<DepartmentFormButton managers={managers} />} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((d) => (
          <Card key={d.id} className={cn("flex flex-col p-5", !d.isActive && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted">{d.code}</p>
                <h2 className="font-semibold">{d.name}</h2>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", d.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>{d.isActive ? "Active" : "Inactive"}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{d.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {d.categories.map((c) => (
                <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium">{CATEGORY_LABELS[c]}</span>
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              <div><dt className="text-[11px] text-muted">Staff</dt><dd className="font-semibold tabular-nums">{d.staffCount}</dd></div>
              <div><dt className="text-[11px] text-muted">Open</dt><dd className="font-semibold tabular-nums">{d.openIssues}</dd></div>
              <div><dt className="text-[11px] text-muted">Total</dt><dd className="font-semibold tabular-nums">{d.totalIssues}</dd></div>
            </dl>
            <p className="mt-4 text-sm"><span className="text-muted">Manager:</span> {d.managerName ?? <span className="text-amber-600">Not assigned</span>}</p>
            <p className="text-xs text-muted">{d.email} {d.phone && `· ${d.phone}`}</p>
            <div className="mt-auto flex items-center gap-4 pt-4">
              <DepartmentFormButton dept={d} managers={managers} />
              <Link href={`/admin/users?departmentId=${d.id}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-200">Team members</Link>
              <Link href={`/admin/issues?departmentId=${d.id}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-200">Issues</Link>
              <span className="ml-auto"><DepartmentActiveToggle id={d.id} isActive={d.isActive} name={d.name} /></span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
