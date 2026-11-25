import "server-only";
import { and, count } from "drizzle-orm";
import { db } from "@/db";
import { issues, type IssueStatus } from "@/db/schema";
import type { CurrentUser } from "../auth";
import { issueScope } from "./issues";

export async function statusCounts(user: CurrentUser) {
  const rows = await db.select({ status: issues.status, n: count() }).from(issues).where(and(issueScope(user))).groupBy(issues.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<IssueStatus, number>>;
  const total = rows.reduce((s, r) => s + r.n, 0);
  return { by, total };
}

