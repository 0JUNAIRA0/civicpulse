import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Calendar, Copy, ExternalLink, MapPin, Star, User, Wrench } from "lucide-react";
import { z } from "zod";
import { requirePageUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { findPossibleDuplicates, getIssueDetail } from "@/server/services/issues";
import { listDepartments, staffOptions } from "@/server/services/departments";
import { getSettings } from "@/server/services/settings";
import { CATEGORY_LABELS, PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { Avatar, Card, CardHeader, CategoryBadge, PriorityBadge, ProgressBar, StatusBadge, TaskStatusBadge } from "@/components/ui";
import { IssueMap } from "@/components/map";
import { WorkflowStepper } from "@/components/issues/workflow-stepper";
import { PdfButton } from "@/components/issues/pdf-button";
import { AssignPanel, CitizenEditPanel, DepartmentPanel, FeedbackForm, ReviewPanel, StatusPanel, TaskNoteForm, TaskWorkPanel, VerifyPanel } from "@/components/issues/actions";

export const metadata: Metadata = { title: "Issue details" };

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let detail;
  try {
    detail = await getIssueDetail(user, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    if (e instanceof AppError && e.status === 403) {
      return (
        <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">You don&apos;t have access to this issue</h1>
          <p className="mt-1 text-sm text-muted">{e.message}</p>
        </Card>
      );
    }
    throw e;
  }
  const { issue, activity, capabilities: cap } = detail;
  const settings = await getSettings();

  const [staff, departments, candidates] = await Promise.all([
    cap.canAssign && issue.departmentId ? staffOptions(issue.departmentId) : Promise.resolve([]),
    cap.canReassignDepartment ? listDepartments() : Promise.resolve([]),
    cap.canVerify ? findPossibleDuplicates({ latitude: issue.latitude, longitude: issue.longitude, category: issue.category, title: issue.title, description: issue.description, excludeId: issue.id, radiusMeters: Math.max(300, settings.duplicateRadiusMeters * 2) }) : Promise.resolve([]),
  ]);
  const dupCandidates = [
    ...(issue.suspectedDuplicateOf ? [{ id: issue.suspectedDuplicateOf.id, referenceCode: issue.suspectedDuplicateOf.referenceCode, title: issue.suspectedDuplicateOf.title }] : []),
    ...candidates.filter((c) => c.id !== issue.suspectedDuplicateOfId),
  ];

  const reportPhotos = issue.attachments.filter((a) => a.kind === "REPORT");
  const workPhotos = issue.attachments.filter((a) => a.kind !== "REPORT");
  const activeTask = issue.tasks.find((t) => t.id === cap.activeTaskId) ?? null;
  const latestTask = activeTask ?? issue.tasks[0] ?? null;
  const fb = issue.feedback[0];
  const back = user.role === "CITIZEN" ? "/citizen/reports" : user.role === "STAFF" ? "/staff/tasks" : user.role === "DEPT_MANAGER" ? "/department/issues" : "/admin/issues";
  const overdue = issue.dueAt && issue.dueAt < new Date() && ["UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"].includes(issue.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-sm text-muted">{issue.referenceCode}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{issue.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={issue.status} />
              <CategoryBadge category={issue.category} />
              <PriorityBadge priority={issue.priority} />
              {overdue && <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600"><AlertTriangle className="size-3.5" /> Overdue</span>}
            </div>
          </div>
          {cap.full && (
            <PdfButton
              issue={{
                referenceCode: issue.referenceCode,
                title: issue.title,
                description: issue.description,
                category: CATEGORY_LABELS[issue.category],
                status: STATUS_LABELS[issue.status],
                priority: issue.priority ? PRIORITY_LABELS[issue.priority] : "Not set",
                address: issue.address,
                coords: `${issue.latitude.toFixed(6)}, ${issue.longitude.toFixed(6)}`,
                area: issue.area ? `${issue.area.name} (${issue.area.zone})` : "—",
                department: issue.department?.name ?? "Unrouted",
                reporter: issue.reporter.name,
                submitted: formatDateTime(issue.createdAt),
                due: formatDate(issue.dueAt),
                resolved: formatDateTime(issue.resolvedAt),
                assignee: latestTask?.assignee.name ?? "—",
                history: issue.history.map((h) => ({ when: formatDateTime(h.createdAt), status: STATUS_LABELS[h.toStatus], by: h.changedBy?.name ?? "System", note: h.note ?? "" })),
                feedback: fb ? `${fb.rating}/5${fb.comment ? ` — ${fb.comment}` : ""}` : undefined,
              }}
            />
          )}
        </div>
      </div>

      <Card className="p-5">
        <WorkflowStepper status={issue.status} history={issue.history} />
        {issue.status === "REJECTED" && issue.rejectionReason && (
          <p className="mt-3 text-sm text-muted">
            Reason: <span className="text-ink">{issue.rejectionReason}</span>
            {issue.duplicateOf && (
              <>
                {" "}· see <Link href={`/issues/${issue.duplicateOf.id}`} className="font-medium text-accent-600 hover:underline">{issue.duplicateOf.referenceCode}</Link>
              </>
            )}
          </p>
        )}
      </Card>

      {issue.suspectedDuplicateOf && cap.full && user.role !== "CITIZEN" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Copy className="mt-0.5 size-4 shrink-0" />
          <p>
            Automatic duplicate detection: this looks similar to{" "}
            <Link href={`/issues/${issue.suspectedDuplicateOf.id}`} className="font-semibold underline">
              {issue.suspectedDuplicateOf.referenceCode} · {issue.suspectedDuplicateOf.title}
            </Link>{" "}
            ({STATUS_LABELS[issue.suspectedDuplicateOf.status]}). Review before verifying.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Report" />
            <div className="space-y-5 p-5">
              <p className="text-sm leading-relaxed whitespace-pre-line">{issue.description}</p>
              {reportPhotos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {reportPhotos.map((a) => (
                    <a key={a.id} href={`/api/uploads/${a.uploadId}`} target="_blank" className="block aspect-[4/3] overflow-hidden rounded-lg border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/uploads/${a.uploadId}`} alt="Reported issue" className="size-full object-cover transition hover:scale-105" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Location"
              description={issue.address}
              action={
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:underline">
                  Directions <ExternalLink className="size-3.5" />
                </a>
              }
            />
            <div className="p-3">
              <IssueMap points={[{ id: issue.id, title: issue.title, category: issue.category, status: issue.status, latitude: issue.latitude, longitude: issue.longitude, referenceCode: issue.referenceCode }]} center={[issue.latitude, issue.longitude]} zoom={16} height={300} highlightId={issue.id} linkable={false} />
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 px-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {issue.area ? `${issue.area.name}, ${issue.area.zone} zone${issue.area.ward ? ` · Ward ${issue.area.ward}` : ""}` : "Area not set"}</span>
                <span className="font-mono">GPS {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}</span>
              </div>
            </div>
          </Card>

          {cap.full && issue.tasks.length > 0 && latestTask && (
            <Card>
              <CardHeader title="Maintenance work" description={`${issue.tasks.length} task${issue.tasks.length > 1 ? "s" : ""} on record`} action={<TaskStatusBadge status={latestTask.status} />} />
              <div className="space-y-5 p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name={latestTask.assignee.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{latestTask.assignee.name}</p>
                    <p className="text-xs text-muted">{latestTask.assignee.jobTitle ?? "Maintenance staff"} · assigned by {latestTask.assignedBy?.name ?? "—"} {timeAgo(latestTask.createdAt)}</p>
                  </div>
                  <div className="w-full sm:w-48">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-muted">Progress</span><span className="font-semibold">{latestTask.progress}%</span></div>
                    <ProgressBar value={latestTask.progress} />
                  </div>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div><p className="text-xs text-muted">Due</p><p className="font-medium">{formatDate(latestTask.dueDate)}</p></div>
                  <div><p className="text-xs text-muted">Started</p><p className="font-medium">{formatDateTime(latestTask.startedAt)}</p></div>
                  <div><p className="text-xs text-muted">Completed</p><p className="font-medium">{formatDateTime(latestTask.completedAt)}</p></div>
                </div>
                {latestTask.instructions && <p className="rounded-lg bg-surface-2 p-3 text-sm"><span className="font-medium">Instructions:</span> {latestTask.instructions}</p>}

                {workPhotos.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Work photos</p>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {workPhotos.map((a) => (
                        <a key={a.id} href={`/api/uploads/${a.uploadId}`} target="_blank" className="relative block aspect-square overflow-hidden rounded-lg border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/uploads/${a.uploadId}`} alt={a.kind === "COMPLETION" ? "Completion photo" : "Progress photo"} className="size-full object-cover" loading="lazy" />
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{a.kind === "COMPLETION" ? "Completed" : "Progress"}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium">Progress reports & notes</p>
                  {issue.tasks.flatMap((t) => t.updates).length === 0 ? (
                    <p className="text-sm text-muted">No updates yet.</p>
                  ) : (
                    <ol className="space-y-3 border-l-2 border-line pl-4">
                      {issue.tasks
                        .flatMap((t) => t.updates.map((u) => ({ ...u, taskStatus: t.status })))
                        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                        .map((u) => (
                          <li key={u.id} className="relative">
                            <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-accent-500 ring-4 ring-surface" />
                            <p className="text-sm">
                              <span className="font-medium">{u.author?.name ?? "System"}</span>{" "}
                              <span className="text-xs text-muted">{u.type === "PROGRESS" ? `progress ${u.progress ?? ""}%` : u.type.toLowerCase()} · {formatDateTime(u.createdAt)}</span>
                            </p>
                            <p className="text-sm text-muted">{u.message}</p>
                          </li>
                        ))}
                    </ol>
                  )}
                </div>
                {activeTask && (user.role === "DEPT_MANAGER" || user.role === "ADMIN") && ["ASSIGNED", "IN_PROGRESS", "REWORK"].includes(activeTask.status) && <TaskNoteForm taskId={activeTask.id} />}
                {issue.tasks.length > 1 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">Earlier tasks</summary>
                    <ul className="mt-2 space-y-1">
                      {issue.tasks.slice(1).map((t) => (
                        <li key={t.id} className="text-muted">{t.assignee.name} · {TASK_STATUS_LABELS[t.status]} · {formatDate(t.createdAt)}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </Card>
          )}

          {fb && (
            <Card className="p-5">
              <p className="text-sm font-semibold">Citizen feedback</p>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={n <= fb.rating ? "size-5 fill-amber-400 text-amber-400" : "size-5 text-line"} />
                ))}
                <span className="ml-2 text-sm text-muted">{formatDate(fb.createdAt)}</span>
              </div>
              {fb.comment && <p className="mt-2 text-sm">“{fb.comment}”</p>}
            </Card>
          )}

          <Card>
            <CardHeader title="Resolution history" description="Every status change, who made it and when. This record cannot be edited." />
            <ol className="space-y-4 p-5">
              {[...issue.history].reverse().map((h) => (
                <li key={h.id} className="flex gap-3">
                  <div className="pt-0.5"><StatusBadge status={h.toStatus} /></div>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{h.changedBy?.name ?? "System"}</span>
                      {h.changedBy && "role" in h.changedBy && <span className="text-xs text-muted"> · {ROLE_LABELS[h.changedBy.role as keyof typeof ROLE_LABELS]}</span>}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(h.createdAt)}{h.fromStatus ? ` · from ${STATUS_LABELS[h.fromStatus]}` : ""}</p>
                    {h.note && <p className="mt-1 text-sm text-muted">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {activity.length > 0 && (
            <Card>
              <CardHeader title="Activity log" />
              <ul className="divide-y divide-line">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{a.summary}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {cap.canWorkTask && activeTask && <TaskWorkPanel taskId={activeTask.id} taskStatus={activeTask.status} progress={activeTask.progress} reviewNote={activeTask.reviewNote} />}
          {cap.canReviewTask && activeTask && <ReviewPanel taskId={activeTask.id} />}
          {cap.canVerify && <VerifyPanel issueId={issue.id} status={issue.status} priority={issue.priority} candidates={dupCandidates} />}
          {cap.canAssign && staff.length > 0 && <AssignPanel issueId={issue.id} staff={staff} currentAssigneeId={activeTask?.assigneeId} priority={issue.priority} reassign={!!activeTask} />}
          {cap.canAssign && staff.length === 0 && <Card className="p-4 text-sm text-muted">No active maintenance staff in this department yet.</Card>}
          {cap.statusTargets.length > 0 && <StatusPanel issueId={issue.id} targets={cap.statusTargets} />}
          {cap.canReassignDepartment && <DepartmentPanel issueId={issue.id} departmentId={issue.departmentId} departments={departments.map((d) => ({ id: d.id, name: d.name }))} />}
          {cap.canFeedback && <FeedbackForm issueId={issue.id} />}
          {cap.canEdit && <CitizenEditPanel issueId={issue.id} title={issue.title} description={issue.description} address={issue.address} />}

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Details</h3>
            <dl className="space-y-3 text-sm">
              <Row icon={<User className="size-4" />} label="Reporter" value={issue.reporter.name} sub={cap.full && user.role !== "CITIZEN" ? issue.reporter.phone ?? issue.reporter.email : undefined} />
              <Row icon={<Wrench className="size-4" />} label="Department" value={issue.department?.name ?? "Not routed yet"} />
              <Row icon={<Calendar className="size-4" />} label="Submitted" value={formatDateTime(issue.createdAt)} />
              {issue.verifiedAt && <Row icon={<Calendar className="size-4" />} label="Verified" value={formatDateTime(issue.verifiedAt)} sub={issue.verifiedBy?.name} />}
              {issue.dueAt && <Row icon={<Calendar className="size-4" />} label="Target date" value={formatDate(issue.dueAt)} />}
              {issue.resolvedAt && <Row icon={<Calendar className="size-4" />} label="Resolved" value={formatDateTime(issue.resolvedAt)} />}
              {issue.closedAt && <Row icon={<Calendar className="size-4" />} label="Closed" value={formatDateTime(issue.closedAt)} />}
            </dl>
          </Card>
          {!cap.full && <p className="px-1 text-xs text-muted">You are viewing the public summary of a report submitted by another citizen.</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string | null }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="font-medium">{value}</dd>
        {sub && <dd className="text-xs text-muted">{sub}</dd>}
      </div>
    </div>
  );
}
