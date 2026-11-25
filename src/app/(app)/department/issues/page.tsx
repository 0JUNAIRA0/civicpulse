import type { Metadata } from "next";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { listIssues } from "@/server/services/issues";
import { statusCounts } from "@/server/services/counts";
import { parseIssueQuery } from "@/server/page-utils";
import { Card, PageHeader } from "@/components/ui";
import { IssueFilters } from "@/components/issues/issue-filters";
import { IssueTable } from "@/components/issues/issue-table";
import { StatusTabs } from "@/components/issues/status-tabs";

export const metadata: Metadata = { title: "Issue management" };

export default async function DepartmentIssues({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser(["DEPT_MANAGER"]);
  const { params, query } = parseIssueQuery(await searchParams);
  const [data, counts, areaRows] = await Promise.all([listIssues(user, query), statusCounts(user), db.select({ id: areas.id, name: areas.name }).from(areas).orderBy(asc(areas.name))]);
  const c = counts.by;
  return (
    <>
      <PageHeader title="Issue management" description="Verify, prioritise and assign your department's reports." />
      <Card>
        <StatusTabs
          base="/department/issues"
          params={params}
          tabs={[
            { label: "All", patch: {}, count: counts.total },
            { label: "Needs verification", patch: { status: "SUBMITTED" }, count: c.SUBMITTED ?? 0 },
            { label: "Ready to assign", patch: { status: "UNDER_REVIEW" }, count: c.UNDER_REVIEW ?? 0 },
            { label: "Assigned", patch: { status: "ASSIGNED" }, count: c.ASSIGNED ?? 0 },
            { label: "In progress", patch: { status: "IN_PROGRESS" }, count: c.IN_PROGRESS ?? 0 },
            { label: "Awaiting review", patch: { status: "RESOLVED" }, count: c.RESOLVED ?? 0 },
            { label: "Closed", patch: { status: "CLOSED" }, count: c.CLOSED ?? 0 },
            { label: "Rejected", patch: { status: "REJECTED" }, count: c.REJECTED ?? 0 },
          ]}
        />
        <Suspense>
          <IssueFilters areas={areaRows} show={{ area: true }} />
        </Suspense>
        <IssueTable data={data} base="/department/issues" params={params} columns={{ assignee: true, reporter: true }} />
      </Card>
    </>
  );
}
