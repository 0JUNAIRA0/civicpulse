"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Copy, Play, RotateCcw, Send, Star, ThumbsUp, Trash2, UserPlus, XCircle } from "lucide-react";
import type { IssueStatus, Priority } from "@/db/schema";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button, Card, Field, inputClass } from "../ui";
import { ImageUploader, type Uploaded } from "../image-uploader";
import { useToast } from "../toast";

function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    setFields({});
    try {
      await fn();
      toast({ kind: "success", title: success });
      router.refresh();
      return true;
    } catch (e) {
      if (e instanceof ApiError) setFields(e.fields);
      toast({ kind: "error", title: e instanceof ApiError ? e.message : "Something went wrong" });
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, run, fields };
}

function Panel({ title, icon, children, tone }: { title: string; icon?: React.ReactNode; children: React.ReactNode; tone?: "accent" | "amber" }) {
  return (
    <Card className={cn("p-4", tone === "accent" && "border-accent-300 dark:border-accent-800", tone === "amber" && "border-amber-300 dark:border-amber-800")}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

/* --------------------------- Manager: verification --------------------------- */
export function VerifyPanel({ issueId, status, priority, candidates }: { issueId: string; status: IssueStatus; priority: Priority | null; candidates: { id: string; referenceCode: string; title: string; distance?: number }[] }) {
  const { busy, run, fields } = useAction();
  const [p, setP] = useState<Priority>(priority ?? "MEDIUM");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"verify" | "reject" | "duplicate">("verify");
  const [reason, setReason] = useState("");
  const [dupId, setDupId] = useState(candidates[0]?.id ?? "");
  const post = (body: object) => api(`/api/issues/${issueId}/verify`, { method: "POST", json: body });
  return (
    <Panel title={status === "SUBMITTED" ? "Verify this report" : "Verification"} icon={<ClipboardCheck className="size-4 text-accent-500" />} tone="accent">
      <div className="flex rounded-lg border border-line p-0.5 text-xs">
        {(["verify", "reject", "duplicate"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded-md px-2 py-1.5 font-medium capitalize", mode === m ? "bg-brand-700 text-white dark:bg-brand-500" : "text-muted")}>
            {m === "duplicate" ? "Duplicate" : m}
          </button>
        ))}
      </div>
      {mode === "verify" && (
        <>
          <Field label="Priority" required>
            <div className="grid grid-cols-4 gap-1">
              {PRIORITIES.map((x) => (
                <button key={x} type="button" onClick={() => setP(x)} className={cn("rounded-md border px-1 py-1.5 text-xs font-semibold", p === x ? "border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-900/40 dark:text-accent-200" : "border-line")}>
                  {PRIORITY_LABELS[x]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Note (optional)">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Confirmed by site photo" />
          </Field>
          <Button className="w-full" variant="accent" loading={busy === "verify"} onClick={() => run("verify", () => post({ action: "verify", priority: p, note: note || undefined }), status === "SUBMITTED" ? "Issue verified" : "Priority updated")}>
            <CheckCircle2 className="size-4" /> {status === "SUBMITTED" ? "Verify & start review" : "Update priority"}
          </Button>
        </>
      )}
      {mode === "reject" && (
        <>
          <Field label="Reason" error={fields.reason} required>
            <textarea className={inputClass} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this report being rejected?" />
          </Field>
          <Button className="w-full" variant="danger" loading={busy === "reject"} onClick={() => run("reject", () => post({ action: "reject", reason }), "Issue rejected")}>
            <XCircle className="size-4" /> Reject report
          </Button>
        </>
      )}
      {mode === "duplicate" && (
        <>
          {candidates.length === 0 ? (
            <p className="text-xs text-muted">No similar open issues were found nearby.</p>
          ) : (
            <Field label="Original issue" error={fields.duplicateOfId}>
              <select className={inputClass} value={dupId} onChange={(e) => setDupId(e.target.value)}>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.referenceCode} · {c.title.slice(0, 40)}
                    {c.distance != null ? ` (${c.distance} m)` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Button className="w-full" variant="outline" disabled={!dupId} loading={busy === "dup"} onClick={() => run("dup", () => post({ action: "duplicate", duplicateOfId: dupId }), "Marked as duplicate")}>
            <Copy className="size-4" /> Mark as duplicate
          </Button>
        </>
      )}
    </Panel>
  );
}

/* --------------------------- Manager: assignment --------------------------- */
export function AssignPanel({ issueId, staff, currentAssigneeId, priority, reassign }: { issueId: string; staff: { id: string; name: string; jobTitle: string | null; activeTasks: number }[]; currentAssigneeId?: string | null; priority: Priority | null; reassign: boolean }) {
  const { busy, run, fields } = useAction();
  const sorted = [...staff].sort((a, b) => a.activeTasks - b.activeTasks);
  const [assigneeId, setAssigneeId] = useState(sorted.find((s) => s.id !== currentAssigneeId)?.id ?? "");
  const [due, setDue] = useState("");
  const [instructions, setInstructions] = useState("");
  const [p, setP] = useState<Priority | "">(priority ?? "");
  return (
    <Panel title={reassign ? "Reassign maintenance task" : "Assign maintenance task"} icon={<UserPlus className="size-4 text-accent-500" />}>
      <Field label="Staff member" error={fields.assigneeId} required hint="Sorted by current workload">
        <select className={inputClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          {sorted.map((s) => (
            <option key={s.id} value={s.id} disabled={s.id === currentAssigneeId}>
              {s.name} · {s.activeTasks} active{s.id === currentAssigneeId ? " (current)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Due date" error={fields.dueDate} hint="Default: from priority SLA">
          <input type="date" className={inputClass} value={due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Priority">
          <select className={inputClass} value={p} onChange={(e) => setP(e.target.value as Priority)}>
            <option value="">Keep</option>
            {PRIORITIES.map((x) => (
              <option key={x} value={x}>{PRIORITY_LABELS[x]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Instructions">
        <textarea className={inputClass} rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Safety notes, materials, access…" />
      </Field>
      <Button
        className="w-full"
        disabled={!assigneeId}
        loading={busy === "assign"}
        onClick={() =>
          run(
            "assign",
            () => api(`/api/issues/${issueId}/assign`, { method: "POST", json: { assigneeId, dueDate: due ? `${due}T17:00:00` : undefined, instructions: instructions || undefined, priority: p || undefined } }),
            "Task assigned",
          )
        }
      >
        <UserPlus className="size-4" /> {reassign ? "Reassign" : "Assign task"}
      </Button>
    </Panel>
  );
}

/* --------------------------- Manager: status & department --------------------------- */
export function StatusPanel({ issueId, targets }: { issueId: string; targets: IssueStatus[] }) {
  const { busy, run } = useAction();
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<IssueStatus | null>(null);
  if (!targets.length) return null;
  const label: Partial<Record<IssueStatus, string>> = { UNDER_REVIEW: "Back to review", IN_PROGRESS: "Reopen (in progress)", RESOLVED: "Mark resolved", CLOSED: "Close issue", REJECTED: "Reject" };
  return (
    <Panel title="Change status">
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button key={t} onClick={() => setTarget(t)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium", target === t ? "border-accent-500 bg-accent-50 dark:bg-accent-900/40" : "border-line hover:bg-surface-2", t === "REJECTED" && "text-rose-600")}>
            {label[t] ?? STATUS_LABELS[t]}
          </button>
        ))}
      </div>
      {target && (
        <>
          <Field label={target === "REJECTED" ? "Reason (required)" : "Note"}>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown to the reporter" />
          </Field>
          <Button
            className="w-full"
            variant={target === "REJECTED" ? "danger" : "primary"}
            loading={busy === "status"}
            onClick={async () => {
              const ok = await run("status", () => api(`/api/issues/${issueId}/status`, { method: "POST", json: { status: target, note: note || undefined } }), `Status changed to ${STATUS_LABELS[target]}`);
              if (ok) {
                setTarget(null);
                setNote("");
              }
            }}
          >
            Confirm: {STATUS_LABELS[target]}
          </Button>
        </>
      )}
    </Panel>
  );
}

export function DepartmentPanel({ issueId, departmentId, departments }: { issueId: string; departmentId: string | null; departments: { id: string; name: string }[] }) {
  const { busy, run } = useAction();
  const [dept, setDept] = useState(departmentId ?? "");
  return (
    <Panel title="Department assignment">
      <select className={inputClass} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
        {!departmentId && <option value="">Choose department…</option>}
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <Button className="w-full" variant="outline" disabled={!dept || dept === departmentId} loading={busy === "dept"} onClick={() => run("dept", () => api(`/api/issues/${issueId}`, { method: "PATCH", json: { departmentId: dept } }), "Department updated")}>
        Move to department
      </Button>
    </Panel>
  );
}

/* --------------------------- Manager: review completed work --------------------------- */
export function ReviewPanel({ taskId }: { taskId: string }) {
  const { busy, run } = useAction();
  const [note, setNote] = useState("");
  return (
    <Panel title="Review completed work" icon={<ClipboardCheck className="size-4 text-amber-500" />} tone="amber">
      <p className="text-xs text-muted">Check the completion photos and notes, then approve to close the issue or send it back.</p>
      <Field label="Review note">
        <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required when requesting rework" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="accent" loading={busy === "approve"} onClick={() => run("approve", () => api(`/api/tasks/${taskId}/review`, { method: "POST", json: { decision: "approve", note: note || undefined } }), "Approved and closed")}>
          <ThumbsUp className="size-4" /> Approve
        </Button>
        <Button variant="outline" loading={busy === "rework"} onClick={() => run("rework", () => api(`/api/tasks/${taskId}/review`, { method: "POST", json: { decision: "rework", note } }), "Rework requested")}>
          <RotateCcw className="size-4" /> Rework
        </Button>
      </div>
    </Panel>
  );
}

export function TaskNoteForm({ taskId, label = "Send a note to the crew" }: { taskId: string; label?: string }) {
  const { busy, run, fields } = useAction();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <input className={inputClass} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={label} aria-label={label} />
        {fields.message && <p className="mt-1 text-xs text-rose-600">{fields.message}</p>}
      </div>
      <Button
        variant="secondary"
        loading={busy === "note"}
        disabled={msg.trim().length < 3}
        onClick={async () => {
          if (await run("note", () => api(`/api/tasks/${taskId}/updates`, { method: "POST", json: { type: "NOTE", message: msg } }), "Note added")) setMsg("");
        }}
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}

/* --------------------------- Staff: work the task --------------------------- */
export function TaskWorkPanel({ taskId, taskStatus, progress, reviewNote }: { taskId: string; taskStatus: string; progress: number; reviewNote?: string | null }) {
  const { busy, run, fields } = useAction();
  const [tab, setTab] = useState<"progress" | "note" | "complete">("progress");
  const [pct, setPct] = useState(Math.max(progress, 10));
  const [msg, setMsg] = useState("");
  const [photos, setPhotos] = useState<Uploaded[]>([]);
  const [donePhotos, setDonePhotos] = useState<Uploaded[]>([]);
  const [doneNote, setDoneNote] = useState("");

  if (taskStatus === "ASSIGNED" || taskStatus === "REWORK") {
    return (
      <Panel title={taskStatus === "REWORK" ? "Rework requested" : "Your task"} icon={<Play className="size-4 text-accent-500" />} tone={taskStatus === "REWORK" ? "amber" : "accent"}>
        {reviewNote && taskStatus === "REWORK" && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">“{reviewNote}”</p>}
        <p className="text-sm text-muted">Start the task when the crew is on site. The citizen will be notified.</p>
        <Button className="w-full" variant="accent" loading={busy === "start"} onClick={() => run("start", () => api(`/api/tasks/${taskId}`, { method: "PATCH", json: { status: "IN_PROGRESS" } }), "Task started")}>
          <Play className="size-4" /> Start work
        </Button>
      </Panel>
    );
  }
  return (
    <Panel title="Update this task" icon={<ClipboardCheck className="size-4 text-accent-500" />} tone="accent">
      <div className="flex rounded-lg border border-line p-0.5 text-xs">
        {([
          ["progress", "Progress"],
          ["note", "Note"],
          ["complete", "Complete"],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-md px-2 py-1.5 font-medium", tab === k ? "bg-brand-700 text-white dark:bg-brand-500" : "text-muted")}>
            {l}
          </button>
        ))}
      </div>
      {tab !== "complete" ? (
        <>
          {tab === "progress" && (
            <Field label={`Progress: ${pct}%`}>
              <input type="range" min={0} max={95} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-[#00A6A6]" />
            </Field>
          )}
          <Field label={tab === "progress" ? "Progress report" : "Maintenance note"} error={fields.message}>
            <textarea className={inputClass} rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={tab === "progress" ? "What was done, what's next" : "Materials, access issues, observations…"} />
          </Field>
          <ImageUploader value={photos} onChange={setPhotos} max={3} label="Photo" />
          <Button
            className="w-full"
            loading={busy === "upd"}
            onClick={async () => {
              const ok = await run(
                "upd",
                () => api(`/api/tasks/${taskId}/updates`, { method: "POST", json: { type: tab === "progress" ? "PROGRESS" : "NOTE", message: msg, progress: tab === "progress" ? pct : undefined, imageIds: photos.map((p) => p.id) } }),
                tab === "progress" ? "Progress reported" : "Note added",
              );
              if (ok) {
                setMsg("");
                setPhotos([]);
              }
            }}
          >
            <Send className="size-4" /> Submit {tab === "progress" ? "progress" : "note"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">Upload at least one photo of the finished work. Your manager will review it before the issue is closed.</p>
          <ImageUploader value={donePhotos} onChange={setDonePhotos} max={5} label="Completion photo" />
          <Field label="Completion note">
            <textarea className={inputClass} rows={2} value={doneNote} onChange={(e) => setDoneNote(e.target.value)} placeholder="What was fixed" />
          </Field>
          <Button
            className="w-full"
            variant="accent"
            disabled={donePhotos.length === 0}
            loading={busy === "done"}
            onClick={() => run("done", () => api(`/api/tasks/${taskId}`, { method: "PATCH", json: { status: "COMPLETED", note: doneNote || undefined, completionImageIds: donePhotos.map((p) => p.id) } }), "Marked as completed")}
          >
            <CheckCircle2 className="size-4" /> Mark task completed
          </Button>
        </>
      )}
    </Panel>
  );
}

/* --------------------------- Citizen --------------------------- */
export function FeedbackForm({ issueId }: { issueId: string }) {
  const { busy, run, fields } = useAction();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <Panel title="How did we do?" icon={<Star className="size-4 text-amber-500" />} tone="accent">
      <p className="text-xs text-muted">Rate the resolution. Your feedback helps rank department performance.</p>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>
            <Star className={cn("size-7", (hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-line")} />
          </button>
        ))}
      </div>
      {fields.rating && <p className="text-xs text-rose-600">{fields.rating}</p>}
      <textarea className={inputClass} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything to add? (optional)" />
      <Button className="w-full" variant="accent" disabled={!rating} loading={busy === "fb"} onClick={() => run("fb", () => api(`/api/issues/${issueId}/feedback`, { method: "POST", json: { rating, comment: comment || undefined } }), "Thanks for your feedback!")}>
        Submit feedback
      </Button>
    </Panel>
  );
}

export function CitizenEditPanel({ issueId, title, description, address }: { issueId: string; title: string; description: string; address: string }) {
  const { busy, run, fields } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [v, setV] = useState({ title, description, address });
  return (
    <Panel title="Manage your report">
      {!editing ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          {!confirm ? (
            <Button variant="outline" className="text-rose-600" onClick={() => setConfirm(true)}>
              <Trash2 className="size-4" /> Withdraw
            </Button>
          ) : (
            <Button variant="danger" loading={busy === "wd"} onClick={() => run("wd", () => api(`/api/issues/${issueId}`, { method: "DELETE" }), "Report withdrawn")}>
              Confirm withdraw
            </Button>
          )}
        </div>
      ) : (
        <>
          <Field label="Title" error={fields.title}>
            <input className={inputClass} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Description" error={fields.description}>
            <textarea className={inputClass} rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <Field label="Address" error={fields.address}>
            <input className={inputClass} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              loading={busy === "edit"}
              onClick={async () => {
                if (await run("edit", () => api(`/api/issues/${issueId}`, { method: "PATCH", json: v }), "Report updated")) setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </>
      )}
      <p className="text-xs text-muted">You can edit or withdraw until the department starts reviewing it.</p>
    </Panel>
  );
}
