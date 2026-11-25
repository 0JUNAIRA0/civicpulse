import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { listIssues } from "@/server/services/issues";
import { parseIssueQuery } from "@/server/page-utils";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { IssueFilters } from "@/components/issues/issue-filters";
import { IssueTable } from "@/components/issues/issue-table";

export const metadata: Metadata = { title: "My reports" };

export default async function MyReports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser(["CITIZEN"]);
  const { params, query } = parseIssueQuery(await searchParams);
  const data = await listIssues(user, { ...query, mine: true });
  return (
    <>
      <PageHeader
        title="My reports"
        description="Every issue you've reported and where it stands."
        actions={
          <LinkButton href="/citizen/report/new" variant="accent">
            <Plus className="size-4" /> New report
          </LinkButton>
        }
      />
      <Card>
        <Suspense>
          <IssueFilters />
        </Suspense>
        <IssueTable data={data} base="/citizen/reports" params={params} emptyTitle="No reports match" emptyAction={<LinkButton href="/citizen/report/new" variant="accent">Report an issue</LinkButton>} />
      </Card>
    </>
  );
}
