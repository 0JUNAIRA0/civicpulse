import "server-only";
import { and, asc, count, desc, eq, exists, gte, ilike, inArray, isNull, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  areas,
  departments,
  feedback,
  issues,
  issueStatusHistory,
  tasks,
  users,
  activityLogs,
  type Issue,
  type IssueCategory,
  type IssueStatus,
} from "@/db/schema";
import { ACTIVE_TASK_STATUSES, DONE_STATUSES, OPEN_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { boundingBox, haversine, inBounds, textSimilarity } from "@/lib/geo";
import { hasPermission } from "@/lib/permissions";
import type { IssueQuery } from "@/lib/validation";
import type { z } from "zod";
import type { assignSchema, createIssueSchema, feedbackSchema, updateIssueSchema, verifySchema } from "@/lib/validation";
import type { CurrentUser } from "../auth";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "./activity";
import { notify, notifyDepartmentManagers } from "./notifications";
import { getSettings } from "./settings";
import { attachUploads } from "./uploads";

/* ----------------------------------------------------------------------------
 * Access control
 * --------------------------------------------------------------------------*/

/** SQL condition restricting `issues` rows to what the user may fully access. */
export function issueScope(user: CurrentUser): SQL | undefined {
  if (hasPermission(user, "issues:view_all")) return undefined;
  switch (user.role) {
    case "DEPT_MANAGER":
      return user.departmentId ? eq(issues.departmentId, user.departmentId) : sql`false`;
    case "STAFF":
      return exists(
        db
          .select({ x: sql`1` })
          .from(tasks)
          .where(and(eq(tasks.issueId, issues.id), eq(tasks.assigneeId, user.id))),
      );
    case "CITIZEN":
      return eq(issues.reporterId, user.id);
    default:
      return sql`false`;
  }
}

function managesIssue(user: CurrentUser, issue: Pick<Issue, "departmentId">) {
  if (user.role === "ADMIN") return true;
  if (hasPermission(user, "issues:view_all") && hasPermission(user, "issues:verify")) return true;
  return user.role === "DEPT_MANAGER" && !!user.departmentId && issue.departmentId === user.departmentId;
}

/** Allowed status transitions. ASSIGNED is entered only by assigning a task. */
export const TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "UNDER_REVIEW"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  REJECTED: ["UNDER_REVIEW"],
};

/** Statuses a manager can set directly through the generic status endpoint. */
export function manualTargets(issue: Pick<Issue, "status">): IssueStatus[] {
  return TRANSITIONS[issue.status].filter((s) => s !== "ASSIGNED");
}

/**
 * The single place an issue's status changes. Validates the transition, stamps
 * lifecycle timestamps, writes the immutable history row and notifies the reporter.
 */
export async function applyTransition(
  tx: Tx,
  issue: Issue,
  to: IssueStatus,
  actor: { id: string; name: string },
  note?: string,
  extra: Partial<typeof issues.$inferInsert> = {},
) {
  if (!TRANSITIONS[issue.status].includes(to)) {
    throw badRequest(`Cannot move an issue from ${STATUS_LABELS[issue.status]} to ${STATUS_LABELS[to]}`);
  }
  const now = new Date();
  const patch: Partial<typeof issues.$inferInsert> = { status: to, ...extra };
  if (to === "RESOLVED") patch.resolvedAt = now;
  if (to === "CLOSED") patch.closedAt = now;
  if (to === "IN_PROGRESS" && issue.status === "RESOLVED") patch.resolvedAt = null;
  if (to === "UNDER_REVIEW" && issue.status === "REJECTED") patch.rejectionReason = null;

  // Optimistic concurrency: only update if nobody changed the status meanwhile.
  const updated = await tx
    .update(issues)
    .set(patch)
    .where(and(eq(issues.id, issue.id), eq(issues.status, issue.status)))
    .returning();
  if (!updated.length) throw conflict("This issue was updated by someone else. Refresh and try again.");

  await tx.insert(issueStatusHistory).values({
    issueId: issue.id,
    fromStatus: issue.status,
    toStatus: to,
    changedById: actor.id,
    note: note || null,
  });

  await notify(
    [issue.reporterId],
    {
      type: "ISSUE_STATUS",
      title: `${issue.referenceCode} is now ${STATUS_LABELS[to]}`,
      message: note ? `${issue.title}: ${note}` : `${issue.title} moved to ${STATUS_LABELS[to]}.`,
      link: `/issues/${issue.id}`,
    },
    tx,
  );
  await logActivity(
    {
      actorId: actor.id,
      action: "issue.status",
      entityType: "issue",
      entityId: issue.id,
      summary: `${actor.name} changed status ${STATUS_LABELS[issue.status]} → ${STATUS_LABELS[to]}`,
      metadata: { from: issue.status, to, note },
    },
    tx,
  );
  return updated[0];
}

async function loadIssueForUpdate(tx: Tx, id: string) {
  const rows = await tx.select().from(issues).where(eq(issues.id, id)).for("update");
  if (!rows[0]) throw notFound("Issue not found");
  return rows[0];
}

/* ----------------------------------------------------------------------------
 * Listing
 * --------------------------------------------------------------------------*/

const currentAssignee = db
  .select({ issueId: tasks.issueId, assigneeName: users.name, assigneeId: users.id })
  .from(tasks)
  .innerJoin(users, eq(users.id, tasks.assigneeId))
  .where(inArray(tasks.status, ["ASSIGNED", "IN_PROGRESS", "REWORK", "COMPLETED"]))
  .as("current_assignee");

const priorityRank = sql<number>`CASE ${issues.priority} WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END`;
const statusRank = sql<number>`array_position(ARRAY['SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED']::issue_status[], ${issues.status})`;

export function buildIssueFilters(user: CurrentUser, q: Partial<IssueQuery>) {
  const where: (SQL | undefined)[] = [issueScope(user)];
  if (q.mine) where.push(eq(issues.reporterId, user.id));
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    where.push(or(ilike(issues.title, term), ilike(issues.description, term), ilike(issues.address, term), ilike(issues.referenceCode, term)));
  }
  if (q.status) where.push(eq(issues.status, q.status));
  if (q.statusGroup === "open") where.push(inArray(issues.status, OPEN_STATUSES));
  if (q.statusGroup === "done") where.push(inArray(issues.status, DONE_STATUSES));
  if (q.category) where.push(eq(issues.category, q.category));
  if (q.priority === "NONE") where.push(isNull(issues.priority));
  else if (q.priority) where.push(eq(issues.priority, q.priority));
  if (q.departmentId) where.push(eq(issues.departmentId, q.departmentId));
  if (q.areaId) where.push(eq(issues.areaId, q.areaId));
  if (q.from) where.push(gte(issues.createdAt, new Date(`${q.from}T00:00:00`)));
  if (q.to) where.push(lte(issues.createdAt, new Date(`${q.to}T23:59:59.999`)));
  return and(...where.filter(Boolean));
}

export async function listIssues(user: CurrentUser, q: IssueQuery) {
  const where = buildIssueFilters(user, q);
  const dir = q.order === "asc" ? asc : desc;
  const sortCol = {
    createdAt: issues.createdAt,
    updatedAt: issues.updatedAt,
    title: issues.title,
    category: issues.category,
    priority: priorityRank,
    status: statusRank,
  }[q.sort];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: issues.id,
        referenceCode: issues.referenceCode,
        title: issues.title,
        category: issues.category,
        status: issues.status,
        priority: issues.priority,
        address: issues.address,
        latitude: issues.latitude,
        longitude: issues.longitude,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        dueAt: issues.dueAt,
        suspectedDuplicateOfId: issues.suspectedDuplicateOfId,
        reporterName: users.name,
        departmentName: departments.name,
        departmentId: issues.departmentId,
        areaName: areas.name,
        assigneeName: currentAssignee.assigneeName,
      })
      .from(issues)
      .leftJoin(users, eq(users.id, issues.reporterId))
      .leftJoin(departments, eq(departments.id, issues.departmentId))
      .leftJoin(areas, eq(areas.id, issues.areaId))
      .leftJoin(currentAssignee, eq(currentAssignee.issueId, issues.id))
      .where(where)
      .orderBy(dir(sortCol), desc(issues.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ total: count() }).from(issues).where(where),
  ]);

  return {
    items: rows,
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}
export type IssueListItem = Awaited<ReturnType<typeof listIssues>>["items"][number];

/* ----------------------------------------------------------------------------
 * Detail
 * --------------------------------------------------------------------------*/

export async function getIssueDetail(user: CurrentUser, id: string) {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
    with: {
      reporter: { columns: { id: true, name: true, email: true, phone: true } },
      department: { columns: { id: true, name: true, code: true } },
      area: true,
      verifiedBy: { columns: { id: true, name: true } },
      duplicateOf: { columns: { id: true, referenceCode: true, title: true, status: true } },
      suspectedDuplicateOf: { columns: { id: true, referenceCode: true, title: true, status: true } },
      attachments: {
        with: { uploadedBy: { columns: { id: true, name: true, role: true } } },
        orderBy: (a, { asc }) => [asc(a.createdAt)],
      },
      history: {
        with: { changedBy: { columns: { id: true, name: true, role: true } } },
        orderBy: (h, { asc }) => [asc(h.createdAt)],
      },
      tasks: {
        with: {
          assignee: { columns: { id: true, name: true, phone: true, jobTitle: true } },
          assignedBy: { columns: { id: true, name: true } },
          updates: {
            with: { author: { columns: { id: true, name: true, role: true } } },
            orderBy: (u, { asc }) => [asc(u.createdAt)],
          },
        },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      },
      feedback: true,
    },
  });
  if (!issue) throw notFound("Issue not found");

  const scope = issueScope(user);
  let full = !scope;
  if (scope) {
    const [hit] = await db.select({ id: issues.id }).from(issues).where(and(eq(issues.id, id), scope));
    full = !!hit;
  }
  // Non-owners who are citizens get a public, redacted view (for transparency / duplicate checks).
  if (!full && user.role !== "CITIZEN") throw forbidden("This issue belongs to another department");

  const activity = full
    ? await db.query.activityLogs.findMany({
        where: and(eq(activityLogs.entityType, "issue"), eq(activityLogs.entityId, id)),
        with: { actor: { columns: { id: true, name: true, role: true } } },
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        limit: 50,
      })
    : [];

  const manages = managesIssue(user, issue);
  const isReporter = issue.reporterId === user.id;
  const activeTask = issue.tasks.find((t) => ACTIVE_TASK_STATUSES.includes(t.status) || t.status === "COMPLETED");
  const isAssignee = !!activeTask && activeTask.assigneeId === user.id;

  const capabilities = {
    full,
    canEdit: isReporter && issue.status === "SUBMITTED",
    canWithdraw: isReporter && issue.status === "SUBMITTED",
    canVerify: manages && hasPermission(user, "issues:verify") && ["SUBMITTED", "UNDER_REVIEW"].includes(issue.status),
    canAssign: manages && hasPermission(user, "tasks:assign") && ["UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"].includes(issue.status),
    canPrioritize: manages && hasPermission(user, "issues:prioritize"),
    canReassignDepartment: manages && hasPermission(user, "issues:reassign_department") && !["CLOSED"].includes(issue.status),
    statusTargets: manages
      ? manualTargets(issue).filter((s) => s !== "CLOSED" || hasPermission(user, "issues:close"))
      : ([] as IssueStatus[]),
    canReviewTask: manages && hasPermission(user, "tasks:review") && activeTask?.status === "COMPLETED",
    canWorkTask: isAssignee && activeTask?.status !== "COMPLETED",
    activeTaskId: activeTask?.id ?? null,
    canFeedback: isReporter && DONE_STATUSES.includes(issue.status) && issue.feedback.length === 0,
  };

  if (!full) {
    return {
      issue: {
        ...issue,
        reporter: { id: "", name: "Community member", email: "", phone: null },
        tasks: [],
        history: issue.history.map((h) => ({ ...h, changedBy: h.changedBy ? { ...h.changedBy, name: "CivicPulse staff" } : null, note: null })),
        attachments: issue.attachments.filter((a) => a.kind === "REPORT"),
      },
      activity: [],
      capabilities,
    };
  }
  return { issue, activity, capabilities };
}
export type IssueDetail = Awaited<ReturnType<typeof getIssueDetail>>;

/* ----------------------------------------------------------------------------
 * Duplicate & nearby detection
 * --------------------------------------------------------------------------*/

export async function findPossibleDuplicates(input: {
  latitude: number;
  longitude: number;
  category?: IssueCategory;
  title?: string;
  description?: string;
  excludeId?: string;
  radiusMeters?: number;
}) {
  const radius = input.radiusMeters ?? (await getSettings()).duplicateRadiusMeters;
  const box = boundingBox(input.latitude, input.longitude, radius);
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120);
  const where = [
    gte(issues.latitude, box.minLat),
    lte(issues.latitude, box.maxLat),
    gte(issues.longitude, box.minLng),
    lte(issues.longitude, box.maxLng),
    notInArray(issues.status, ["CLOSED", "REJECTED"]),
    gte(issues.createdAt, since),
  ];
  if (input.category) where.push(eq(issues.category, input.category));
  if (input.excludeId) where.push(ne(issues.id, input.excludeId));
  const rows = await db
    .select({
      id: issues.id,
      referenceCode: issues.referenceCode,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      category: issues.category,
      latitude: issues.latitude,
      longitude: issues.longitude,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(and(...where))
    .limit(50);

  const text = `${input.title ?? ""} ${input.description ?? ""}`.trim();
  return rows
    .map((r) => {
      const distance = haversine(input.latitude, input.longitude, r.latitude, r.longitude);
      const similarity = text ? textSimilarity(text, `${r.title} ${r.description}`) : 0;
      // Closer + more similar text = higher score (0..1).
      const score = 0.65 * (1 - distance / radius) + 0.35 * Math.min(1, similarity * 2);
      return { id: r.id, referenceCode: r.referenceCode, title: r.title, status: r.status, category: r.category, createdAt: r.createdAt, distance: Math.round(distance), similarity, score };
    })
    .filter((r) => r.distance <= radius)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function nearbyIssues(lat: number, lng: number, radiusMeters: number, limit = 50) {
  const box = boundingBox(lat, lng, radiusMeters);
  const rows = await db
    .select({
      id: issues.id,
      referenceCode: issues.referenceCode,
      title: issues.title,
      category: issues.category,
      status: issues.status,
      priority: issues.priority,
      latitude: issues.latitude,
      longitude: issues.longitude,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(
      and(
        gte(issues.latitude, box.minLat),
        lte(issues.latitude, box.maxLat),
        gte(issues.longitude, box.minLng),
        lte(issues.longitude, box.maxLng),
        ne(issues.status, "REJECTED"),
      ),
    )
    .limit(500);
  return rows
    .map((r) => ({ ...r, distance: Math.round(haversine(lat, lng, r.latitude, r.longitude)) }))
    .filter((r) => r.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/** Lightweight points for the map. All signed-in users see the public map (no reporter data). */
export async function mapIssues(user: CurrentUser, q: Partial<IssueQuery> & { scope?: "all" | "mine" }) {
  const where: (SQL | undefined)[] = [ne(issues.status, "REJECTED")];
  if (q.scope === "mine") where.push(issueScope(user));
  if (q.status) where.push(eq(issues.status, q.status));
  if (q.statusGroup === "open") where.push(inArray(issues.status, OPEN_STATUSES));
  if (q.statusGroup === "done") where.push(inArray(issues.status, DONE_STATUSES));
  if (q.category) where.push(eq(issues.category, q.category));
  if (q.priority && q.priority !== "NONE") where.push(eq(issues.priority, q.priority));
  if (q.departmentId) where.push(eq(issues.departmentId, q.departmentId));
  if (q.areaId) where.push(eq(issues.areaId, q.areaId));
  if (q.from) where.push(gte(issues.createdAt, new Date(`${q.from}T00:00:00`)));
  if (q.to) where.push(lte(issues.createdAt, new Date(`${q.to}T23:59:59.999`)));
  return db
    .select({
      id: issues.id,
      referenceCode: issues.referenceCode,
      title: issues.title,
      category: issues.category,
      status: issues.status,
      priority: issues.priority,
      latitude: issues.latitude,
      longitude: issues.longitude,
      areaName: areas.name,
      areaId: issues.areaId,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .leftJoin(areas, eq(areas.id, issues.areaId))
    .where(and(...where.filter(Boolean)))
    .orderBy(desc(issues.createdAt))
    .limit(3000);
}

/* ----------------------------------------------------------------------------
 * Mutations
 * --------------------------------------------------------------------------*/

async function nearestArea(lat: number, lng: number) {
  const all = await db.select().from(areas);
  let best: (typeof all)[number] | null = null;
  let bestD = Infinity;
  for (const a of all) {
    const d = haversine(lat, lng, a.latitude, a.longitude);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return bestD <= 4000 ? best : null;
}

async function departmentForCategory(category: IssueCategory) {
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.isActive, true), sql`${category}::issue_category = ANY(${departments.categories})`))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function createIssue(user: CurrentUser, input: z.infer<typeof createIssueSchema>) {
  if (!hasPermission(user, "issues:create")) throw forbidden("Only citizens can submit new issues");
  const settings = await getSettings();
  if (!inBounds(input.latitude, input.longitude, settings.cityBounds)) {
    throw new AppError(422, `The location must be inside ${settings.cityName} city limits`, "VALIDATION_ERROR", {
      fields: { latitude: "Location is outside the service area" },
    });
  }

  let areaId = input.areaId ?? null;
  if (areaId) {
    const a = await db.query.areas.findFirst({ where: eq(areas.id, areaId) });
    if (!a) throw badRequest("Unknown area");
  } else {
    areaId = (await nearestArea(input.latitude, input.longitude))?.id ?? null;
  }
  const departmentId = settings.autoRouteToDepartment ? await departmentForCategory(input.category) : null;
  const dupes = await findPossibleDuplicates({ ...input, radiusMeters: settings.duplicateRadiusMeters });
  const suspected = dupes.find((d) => d.score >= 0.55) ?? null;

  const issue = await db.transaction(async (tx) => {
    const [{ n }] = (await tx.execute<{ n: string }>(sql`select nextval('issue_ref_seq') as n`)).rows;
    const referenceCode = `CP-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
    const [row] = await tx
      .insert(issues)
      .values({
        referenceCode,
        title: input.title,
        description: input.description,
        category: input.category,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        areaId,
        reporterId: user.id,
        departmentId,
        suspectedDuplicateOfId: suspected?.id ?? null,
      })
      .returning();
    await attachUploads(tx, { issueId: row.id, uploadIds: input.imageIds, kind: "REPORT", actorId: user.id });
    await tx.insert(issueStatusHistory).values({
      issueId: row.id,
      fromStatus: null,
      toStatus: "SUBMITTED",
      changedById: user.id,
      note: "Report submitted",
    });
    await logActivity(
      { actorId: user.id, action: "issue.create", entityType: "issue", entityId: row.id, summary: `${user.name} reported ${referenceCode}` },
      tx,
    );
    await notifyDepartmentManagers(
      departmentId,
      {
        type: "ISSUE_STATUS",
        title: `New report ${referenceCode}`,
        message: `${row.title}${suspected ? ` (possible duplicate of ${suspected.referenceCode})` : ""}`,
        link: `/issues/${row.id}`,
      },
      tx,
    );
    await notify(
      [user.id],
      {
        type: "ISSUE_STATUS",
        title: `We received ${referenceCode}`,
        message: "Your report was submitted and will be reviewed by the responsible department.",
        link: `/issues/${row.id}`,
      },
      tx,
    );
    return row;
  });
  return { issue, possibleDuplicates: dupes };
}

export async function updateIssue(user: CurrentUser, id: string, input: z.infer<typeof updateIssueSchema>) {
  return db.transaction(async (tx) => {
    const issue = await loadIssueForUpdate(tx, id);
    const isReporter = issue.reporterId === user.id;
    const manages = managesIssue(user, issue);
    const patch: Partial<typeof issues.$inferInsert> = {};
    const changes: string[] = [];

    if (input.title || input.description || input.address) {
      if (!isReporter) throw forbidden("Only the reporter can edit the report text");
      if (issue.status !== "SUBMITTED") throw badRequest("Reports can only be edited before review starts");
      if (input.title) patch.title = input.title;
      if (input.description) patch.description = input.description;
      if (input.address) patch.address = input.address;
      changes.push("details");
    }
    if (input.priority) {
      if (!manages || !hasPermission(user, "issues:prioritize")) throw forbidden();
      patch.priority = input.priority;
      const settings = await getSettings();
      patch.dueAt = new Date((issue.verifiedAt ?? new Date()).getTime() + settings.slaDays[input.priority] * 86400000);
      changes.push(`priority → ${input.priority}`);
    }
    if (input.departmentId && input.departmentId !== issue.departmentId) {
      if (!manages || !hasPermission(user, "issues:reassign_department")) throw forbidden();
      const dept = await tx.query.departments.findFirst({ where: eq(departments.id, input.departmentId) });
      if (!dept || !dept.isActive) throw badRequest("Choose an active department");
      const open = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.issueId, id), inArray(tasks.status, [...ACTIVE_TASK_STATUSES, "COMPLETED"])));
      if (open.length) throw badRequest("Cancel or finish the current maintenance task before moving departments");
      patch.departmentId = dept.id;
      changes.push(`department → ${dept.name}`);
      await notifyDepartmentManagers(
        dept.id,
        { type: "ISSUE_STATUS", title: `${issue.referenceCode} transferred to your department`, message: issue.title, link: `/issues/${id}` },
        tx,
      );
    }
    if (!changes.length) return issue;
    const [row] = await tx.update(issues).set(patch).where(eq(issues.id, id)).returning();
    await logActivity(
      { actorId: user.id, action: "issue.update", entityType: "issue", entityId: id, summary: `${user.name} updated ${changes.join(", ")}` },
      tx,
    );
    return row;
  });
}

export async function withdrawIssue(user: CurrentUser, id: string) {
  return db.transaction(async (tx) => {
    const issue = await loadIssueForUpdate(tx, id);
    if (issue.reporterId !== user.id) throw forbidden("You can only withdraw your own reports");
    if (issue.status !== "SUBMITTED") throw badRequest("Only reports that are not yet under review can be withdrawn");
    // History is preserved: withdrawing is a status change, not a delete.
    return applyTransition(tx, issue, "REJECTED", user, "Withdrawn by reporter", { rejectionReason: "Withdrawn by reporter" });
  });
}

export async function changeStatus(user: CurrentUser, id: string, to: IssueStatus, note?: string) {
  return db.transaction(async (tx) => {
    const issue = await loadIssueForUpdate(tx, id);
    if (!managesIssue(user, issue)) throw forbidden("Only the responsible department can change this issue's status");
    if (to === "ASSIGNED") throw badRequest("Assign a maintenance task to move an issue to Assigned");
    if (to === "CLOSED" && !hasPermission(user, "issues:close")) throw forbidden("You are not allowed to close issues");
    if (to === "REJECTED" && !note) throw badRequest("Give a reason for rejecting");
    const extra: Partial<typeof issues.$inferInsert> = {};
    if (to === "REJECTED") extra.rejectionReason = note;
    if (to === "UNDER_REVIEW" && issue.status === "ASSIGNED") {
      // Unassigning: cancel the open task.
      await tx
        .update(tasks)
        .set({ status: "CANCELLED" })
        .where(and(eq(tasks.issueId, id), inArray(tasks.status, ACTIVE_TASK_STATUSES)));
    }
    if (to === "CLOSED") {
      await tx.update(tasks).set({ status: "APPROVED", reviewedAt: new Date(), reviewedById: user.id }).where(and(eq(tasks.issueId, id), eq(tasks.status, "COMPLETED")));
    }
    return applyTransition(tx, issue, to, user, note, extra);
  });
}

export async function verifyIssue(user: CurrentUser, id: string, input: z.infer<typeof verifySchema>) {
  return db.transaction(async (tx) => {
    const issue = await loadIssueForUpdate(tx, id);
    if (!managesIssue(user, issue) || !hasPermission(user, "issues:verify")) throw forbidden("You cannot verify this issue");
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(issue.status)) throw badRequest("Only new or under-review issues can be verified");

    if (input.action === "verify") {
      const settings = await getSettings();
      const now = new Date();
      const extra = {
        priority: input.priority,
        verifiedById: user.id,
        verifiedAt: now,
        dueAt: new Date(now.getTime() + settings.slaDays[input.priority] * 86400000),
        suspectedDuplicateOfId: null,
      };
      if (issue.status === "SUBMITTED") {
        return applyTransition(tx, issue, "UNDER_REVIEW", user, input.note || `Verified with ${input.priority.toLowerCase()} priority`, extra);
      }
      const [row] = await tx.update(issues).set(extra).where(eq(issues.id, id)).returning();
      await logActivity(
        { actorId: user.id, action: "issue.verify", entityType: "issue", entityId: id, summary: `${user.name} verified with ${input.priority} priority` },
        tx,
      );
      return row;
    }
    if (input.action === "reject") {
      return applyTransition(tx, issue, "REJECTED", user, input.reason, { rejectionReason: input.reason });
    }
    // duplicate
    if (input.duplicateOfId === id) throw badRequest("An issue cannot duplicate itself");
    const original = await tx.query.issues.findFirst({ where: eq(issues.id, input.duplicateOfId) });
    if (!original) throw badRequest("Original issue not found");
    const note = input.note || `Duplicate of ${original.referenceCode}`;
    const row = await applyTransition(tx, issue, "REJECTED", user, note, {
      duplicateOfId: original.id,
      rejectionReason: `Duplicate of ${original.referenceCode}`,
      suspectedDuplicateOfId: null,
    });
    return row;
  });
}

export async function assignIssue(user: CurrentUser, id: string, input: z.infer<typeof assignSchema>) {
  return db.transaction(async (tx) => {
    const issue = await loadIssueForUpdate(tx, id);
    if (!managesIssue(user, issue) || !hasPermission(user, "tasks:assign")) throw forbidden("You cannot assign this issue");
    if (issue.status === "SUBMITTED") throw badRequest("Verify the issue before assigning it");
    if (!["UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"].includes(issue.status)) throw badRequest("This issue can no longer be assigned");
    const staff = await tx.query.users.findFirst({ where: eq(users.id, input.assigneeId) });
    if (!staff || staff.role !== "STAFF" || !staff.isActive) throw badRequest("Choose an active maintenance staff member");
    if (staff.departmentId !== issue.departmentId) throw badRequest("The staff member must belong to the issue's department");

    // Reassignment cancels any open task.
    await tx
      .update(tasks)
      .set({ status: "CANCELLED" })
      .where(and(eq(tasks.issueId, id), inArray(tasks.status, ACTIVE_TASK_STATUSES)));

    const settings = await getSettings();
    const priority = input.priority ?? issue.priority ?? "MEDIUM";
    const dueDate = input.dueDate ?? new Date(Date.now() + settings.slaDays[priority] * 86400000);
    if (dueDate.getTime() < Date.now() - 86400000) throw badRequest("Due date cannot be in the past");

    const [task] = await tx
      .insert(tasks)
      .values({ issueId: id, assigneeId: staff.id, assignedById: user.id, instructions: input.instructions, dueDate })
      .returning();
    if (input.priority && input.priority !== issue.priority) {
      await tx.update(issues).set({ priority: input.priority }).where(eq(issues.id, id));
    }
    await tx.update(issues).set({ dueAt: dueDate }).where(eq(issues.id, id));

    const note = `Assigned to ${staff.name}`;
    if (issue.status === "UNDER_REVIEW") {
      await applyTransition(tx, { ...issue }, "ASSIGNED", user, note);
    } else {
      await logActivity(
        { actorId: user.id, action: "task.reassign", entityType: "issue", entityId: id, summary: `${user.name} reassigned the task to ${staff.name}` },
        tx,
      );
    }
    await notify(
      [staff.id],
      {
        type: "TASK_ASSIGNED",
        title: `New task: ${issue.referenceCode}`,
        message: `${issue.title}. Due ${dueDate.toDateString()}.`,
        link: `/issues/${id}`,
      },
      tx,
    );
    return task;
  });
}

export async function submitFeedback(user: CurrentUser, id: string, input: z.infer<typeof feedbackSchema>) {
  return db.transaction(async (tx) => {
    const issue = await loadIssueForUpdate(tx, id);
    if (issue.reporterId !== user.id) throw forbidden("Only the reporter can leave feedback");
    if (!DONE_STATUSES.includes(issue.status)) throw badRequest("Feedback opens once the issue is resolved");
    const existing = await tx.query.feedback.findFirst({ where: eq(feedback.issueId, id) });
    if (existing) throw conflict("You already left feedback for this issue");
    const [row] = await tx.insert(feedback).values({ issueId: id, citizenId: user.id, rating: input.rating, comment: input.comment }).returning();
    await logActivity(
      { actorId: user.id, action: "issue.feedback", entityType: "issue", entityId: id, summary: `${user.name} rated the resolution ${input.rating}/5` },
      tx,
    );
    await notifyDepartmentManagers(
      issue.departmentId,
      { type: "FEEDBACK", title: `Feedback on ${issue.referenceCode}: ${input.rating}/5`, message: input.comment || issue.title, link: `/issues/${id}` },
      tx,
    );
    return row;
  });
}

export async function issueStatsForReporter(userId: string) {
  const rows = await db
    .select({ status: issues.status, n: count() })
    .from(issues)
    .where(eq(issues.reporterId, userId))
    .groupBy(issues.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<IssueStatus, number>>;
  const total = rows.reduce((s, r) => s + r.n, 0);
  const open = OPEN_STATUSES.reduce((s, k) => s + (by[k] ?? 0), 0);
  const done = DONE_STATUSES.reduce((s, k) => s + (by[k] ?? 0), 0);
  return { total, open, done, rejected: by.REJECTED ?? 0, by };
}

