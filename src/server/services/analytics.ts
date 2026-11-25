import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

export type AnalyticsFilter = { from?: string; to?: string; departmentId?: string };

function issueWhere(f: AnalyticsFilter, alias = "i"): SQL {
  const parts: SQL[] = [sql`true`];
  if (f.from) parts.push(sql`${sql.raw(alias)}.created_at >= ${`${f.from}T00:00:00`}::timestamptz`);
  if (f.to) parts.push(sql`${sql.raw(alias)}.created_at <= ${`${f.to}T23:59:59.999`}::timestamptz`);
  if (f.departmentId) parts.push(sql`${sql.raw(alias)}.department_id = ${f.departmentId}::uuid`);
  return sql.join(parts, sql` AND `);
}

async function rows<T>(q: SQL) {
  return (await db.execute(q)).rows as T[];
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function overview(f: AnalyticsFilter) {
  const w = issueWhere(f);
  const [k] = await rows<Record<string, string | null>>(sql`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE i.status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) AS pending,
      count(*) FILTER (WHERE i.status IN ('RESOLVED','CLOSED')) AS resolved,
      count(*) FILTER (WHERE i.status = 'REJECTED') AS rejected,
      count(*) FILTER (WHERE i.status = 'SUBMITTED') AS awaiting_review,
      count(*) FILTER (WHERE i.priority = 'CRITICAL' AND i.status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) AS critical_open,
      count(*) FILTER (WHERE i.due_at < now() AND i.status IN ('UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) AS overdue,
      avg(extract(epoch FROM (i.resolved_at - i.created_at)) / 3600) FILTER (WHERE i.resolved_at IS NOT NULL) AS avg_resolution_hours,
      count(*) FILTER (WHERE i.resolved_at IS NOT NULL AND i.due_at IS NOT NULL AND i.resolved_at <= i.due_at) AS on_time,
      count(*) FILTER (WHERE i.resolved_at IS NOT NULL AND i.due_at IS NOT NULL) AS with_due
    FROM issues i WHERE ${w}`);
  const [t] = await rows<Record<string, string>>(sql`
    SELECT count(*) FILTER (WHERE t.status IN ('ASSIGNED','IN_PROGRESS','REWORK')) AS active,
           count(*) FILTER (WHERE t.status = 'COMPLETED') AS awaiting_review
    FROM tasks t JOIN issues i ON i.id = t.issue_id WHERE ${w}`);
  const [s] = await rows<Record<string, string | null>>(sql`
    SELECT avg(f.rating) AS avg_rating, count(*) AS responses
    FROM feedback f JOIN issues i ON i.id = f.issue_id WHERE ${w}`);
  return {
    total: num(k.total),
    pending: num(k.pending),
    resolved: num(k.resolved),
    rejected: num(k.rejected),
    awaitingReview: num(k.awaiting_review),
    criticalOpen: num(k.critical_open),
    overdue: num(k.overdue),
    avgResolutionHours: k.avg_resolution_hours == null ? null : Number(k.avg_resolution_hours),
    onTimeRate: num(k.with_due) ? num(k.on_time) / num(k.with_due) : null,
    activeTasks: num(t.active),
    tasksAwaitingReview: num(t.awaiting_review),
    avgRating: s.avg_rating == null ? null : Number(s.avg_rating),
    feedbackCount: num(s.responses),
  };
}

export async function monthlyTrends(f: AnalyticsFilter, months = 12) {
  const deptCond = f.departmentId ? sql`AND i.department_id = ${f.departmentId}::uuid` : sql``;
  const r = await rows<{ month: string; reported: string; resolved: string }>(sql`
    WITH m AS (
      SELECT generate_series(date_trunc('month', now()) - make_interval(months => ${months - 1}), date_trunc('month', now()), interval '1 month') AS month
    )
    SELECT to_char(m.month, 'YYYY-MM') AS month,
      (SELECT count(*) FROM issues i WHERE date_trunc('month', i.created_at) = m.month ${deptCond}) AS reported,
      (SELECT count(*) FROM issues i WHERE i.resolved_at IS NOT NULL AND date_trunc('month', i.resolved_at) = m.month ${deptCond}) AS resolved
    FROM m ORDER BY m.month`);
  return r.map((x) => ({
    month: x.month,
    label: new Date(`${x.month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    reported: num(x.reported),
    resolved: num(x.resolved),
  }));
}

export async function byCategory(f: AnalyticsFilter) {
  const r = await rows<{ category: string; total: string; open: string; resolved: string }>(sql`
    SELECT i.category, count(*) AS total,
      count(*) FILTER (WHERE i.status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) AS open,
      count(*) FILTER (WHERE i.status IN ('RESOLVED','CLOSED')) AS resolved
    FROM issues i WHERE ${issueWhere(f)} GROUP BY i.category ORDER BY total DESC`);
  return r.map((x) => ({ category: x.category, total: num(x.total), open: num(x.open), resolved: num(x.resolved) }));
}

export async function byStatus(f: AnalyticsFilter) {
  const r = await rows<{ status: string; total: string }>(sql`
    SELECT i.status, count(*) AS total FROM issues i WHERE ${issueWhere(f)} GROUP BY i.status`);
  return r.map((x) => ({ status: x.status, total: num(x.total) }));
}

export async function byPriority(f: AnalyticsFilter) {
  const r = await rows<{ priority: string | null; total: string }>(sql`
    SELECT coalesce(i.priority::text, 'UNSET') AS priority, count(*) AS total FROM issues i WHERE ${issueWhere(f)} GROUP BY 1`);
  return r.map((x) => ({ priority: x.priority ?? "UNSET", total: num(x.total) }));
}

/** Department performance with a composite score used for ranking. */
export async function departmentPerformance(f: AnalyticsFilter) {
  const dateCond = sql.join(
    [
      f.from ? sql`AND i.created_at >= ${`${f.from}T00:00:00`}::timestamptz` : sql``,
      f.to ? sql`AND i.created_at <= ${`${f.to}T23:59:59.999`}::timestamptz` : sql``,
    ],
    sql` `,
  );
  const r = await rows<Record<string, string | null>>(sql`
    SELECT d.id, d.name, d.code,
      count(i.id) AS total,
      count(i.id) FILTER (WHERE i.status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) AS open,
      count(i.id) FILTER (WHERE i.status IN ('RESOLVED','CLOSED')) AS resolved,
      count(i.id) FILTER (WHERE i.due_at < now() AND i.status IN ('UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) AS overdue,
      avg(extract(epoch FROM (i.resolved_at - i.created_at)) / 3600) FILTER (WHERE i.resolved_at IS NOT NULL) AS avg_hours,
      count(i.id) FILTER (WHERE i.resolved_at IS NOT NULL AND i.due_at IS NOT NULL AND i.resolved_at <= i.due_at) AS on_time,
      count(i.id) FILTER (WHERE i.resolved_at IS NOT NULL AND i.due_at IS NOT NULL) AS with_due,
      (SELECT avg(f.rating) FROM feedback f JOIN issues i2 ON i2.id = f.issue_id WHERE i2.department_id = d.id) AS avg_rating,
      (SELECT count(*) FROM users u WHERE u.department_id = d.id AND u.role = 'STAFF' AND u.is_active) AS staff
    FROM departments d
    LEFT JOIN issues i ON i.department_id = d.id AND i.status <> 'REJECTED' ${dateCond}
    WHERE d.is_active
    GROUP BY d.id ORDER BY d.name`);
  const list = r.map((x) => {
    const total = num(x.total);
    const resolved = num(x.resolved);
    const resolutionRate = total ? resolved / total : 0;
    const onTimeRate = num(x.with_due) ? num(x.on_time) / num(x.with_due) : 0;
    const avgRating = x.avg_rating == null ? null : Number(x.avg_rating);
    // A department with no reports in the period has nothing to score yet.
    const score = total ? Math.round(100 * (0.45 * resolutionRate + 0.3 * onTimeRate + 0.25 * ((avgRating ?? 3) / 5))) : null;
    return {
      id: x.id as string,
      name: x.name as string,
      code: x.code as string,
      total,
      open: num(x.open),
      resolved,
      overdue: num(x.overdue),
      staff: num(x.staff),
      avgHours: x.avg_hours == null ? null : Number(x.avg_hours),
      resolutionRate,
      onTimeRate,
      avgRating,
      score,
    };
  });
  list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
  let rank = 0;
  return list.map((d) => ({ ...d, rank: d.score == null ? null : ++rank }));
}

export async function areaDistribution(f: AnalyticsFilter, limit = 12) {
  const r = await rows<{ id: string; name: string; zone: string; latitude: number; longitude: number; total: string; open: string }>(sql`
    SELECT a.id, a.name, a.zone, a.latitude, a.longitude, count(i.id) AS total,
      count(i.id) FILTER (WHERE i.status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) AS open
    FROM areas a JOIN issues i ON i.area_id = a.id
    WHERE ${issueWhere(f)}
    GROUP BY a.id ORDER BY total DESC LIMIT ${limit}`);
  return r.map((x) => ({ ...x, total: num(x.total), open: num(x.open) }));
}

export async function zoneDistribution(f: AnalyticsFilter) {
  const r = await rows<{ zone: string; total: string }>(sql`
    SELECT a.zone, count(i.id) AS total FROM areas a JOIN issues i ON i.area_id = a.id WHERE ${issueWhere(f)} GROUP BY a.zone ORDER BY total DESC`);
  return r.map((x) => ({ zone: x.zone, total: num(x.total) }));
}

export async function satisfaction(f: AnalyticsFilter) {
  const dist = await rows<{ rating: number; total: string }>(sql`
    SELECT f.rating, count(*) AS total FROM feedback f JOIN issues i ON i.id = f.issue_id WHERE ${issueWhere(f)} GROUP BY f.rating ORDER BY f.rating`);
  const byDept = await rows<{ name: string; avg: string; total: string }>(sql`
    SELECT d.name, avg(f.rating) AS avg, count(*) AS total
    FROM feedback f JOIN issues i ON i.id = f.issue_id JOIN departments d ON d.id = i.department_id
    WHERE ${issueWhere(f)} GROUP BY d.name ORDER BY avg DESC`);
  const ratings = [1, 2, 3, 4, 5].map((n) => ({ rating: n, label: `${n}★`, total: num(dist.find((d) => Number(d.rating) === n)?.total) }));
  const responses = ratings.reduce((s, r) => s + r.total, 0);
  const promoters = ratings.filter((r) => r.rating >= 4).reduce((s, r) => s + r.total, 0);
  return {
    ratings,
    responses,
    satisfiedRate: responses ? promoters / responses : null,
    byDepartment: byDept.map((d) => ({ name: d.name, avg: Number(Number(d.avg).toFixed(2)), total: num(d.total) })),
  };
}

export async function heatPoints(f: AnalyticsFilter) {
  const r = await rows<{ latitude: number; longitude: number; w: number }>(sql`
    SELECT i.latitude, i.longitude,
      CASE i.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 0.8 WHEN 'MEDIUM' THEN 0.55 ELSE 0.35 END AS w
    FROM issues i WHERE ${issueWhere(f)} AND i.status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS')`);
  return r.map((x) => [x.latitude, x.longitude, Number(x.w)] as [number, number, number]);
}

export async function recentActivity(limit = 12, departmentId?: string) {
  const cond = departmentId ? sql`WHERE i.department_id = ${departmentId}::uuid` : sql``;
  return rows<{ id: string; summary: string; created_at: string; entity_id: string | null; reference_code: string | null; actor: string | null }>(sql`
    SELECT l.id, l.summary, l.created_at, l.entity_id, i.reference_code, u.name AS actor
    FROM activity_logs l
    LEFT JOIN issues i ON l.entity_type = 'issue' AND i.id = l.entity_id
    LEFT JOIN users u ON u.id = l.actor_id
    ${cond}
    ORDER BY l.created_at DESC LIMIT ${limit}`);
}

export async function fullAnalytics(f: AnalyticsFilter) {
  const [kpis, monthly, categories, statuses, priorities, departments, areas, zones, sat] = await Promise.all([
    overview(f),
    monthlyTrends(f),
    byCategory(f),
    byStatus(f),
    byPriority(f),
    departmentPerformance(f),
    areaDistribution(f),
    zoneDistribution(f),
    satisfaction(f),
  ]);
  return { kpis, monthly, categories, statuses, priorities, departments, areas, zones, satisfaction: sat };
}
