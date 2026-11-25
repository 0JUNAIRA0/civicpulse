import type { Metadata } from "next";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { listIssues } from "@/server/services/issues";
import { statusCounts } from "@/server/services/counts";
import { listDepartments } from "@/server/services/departments";
import { parseIssueQuery } from "@/server/page-utils";
import { Card, PageHeader } from "@/components/ui";
import { IssueFilters } from "@/components/issues/issue-filters";
import { IssueTable } from "@/components/issues/issue-table";
import { StatusTabs } from "@/components/issues/status-tabs";

export const metadata: Metadata = { title: "All issues" };

export default async function AdminIssues({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { params, query } = parseIssueQuery(await searchParams);
  const [data, counts, depts, areaRows] = await Promise.all([listIssues(user, query), statusCounts(user), listDepartments({ includeInactive: true }), db.select({ id: areas.id, name: areas.name }).from(areas).orderBy(asc(areas.name))]);
  const c = counts.by;
  return (
    <>
      <PageHeader title="All issues" description="Monitor every report across all departments." />
      <Card>
        <StatusTabs
          base="/admin/issues"
          params={params}
          tabs={[
            { label: "All", patch: {}, count: counts.total },
            { label: "Open", patch: { statusGroup: "open" }, count: (c.SUBMITTED ?? 0) + (c.UNDER_REVIEW ?? 0) + (c.ASSIGNED ?? 0) + (c.IN_PROGRESS ?? 0) },
            { label: "Submitted", patch: { status: "SUBMITTED" }, count: c.SUBMITTED ?? 0 },
            { label: "Under review", patch: { status: "UNDER_REVIEW" }, count: c.UNDER_REVIEW ?? 0 },
            { label: "In progress", patch: { status: "IN_PROGRESS" }, count: c.IN_PROGRESS ?? 0 },
            { label: "Resolved", patch: { status: "RESOLVED" }, count: c.RESOLVED ?? 0 },
            { label: "Closed", patch: { status: "CLOSED" }, count: c.CLOSED ?? 0 },
            { label: "Rejected", patch: { status: "REJECTED" }, count: c.REJECTED ?? 0 },
          ]}
        />
        <Suspense>
          <IssueFilters departments={depts.map((d) => ({ id: d.id, name: d.name }))} areas={areaRows} show={{ department: true, area: true }} />
        </Suspense>
        <IssueTable data={data} base="/admin/issues" params={params} columns={{ department: true, assignee: true, reporter: true }} />
      </Card>
    </>
  );
}
