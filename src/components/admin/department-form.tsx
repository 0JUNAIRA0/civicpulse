"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { IssueCategory } from "@/db/schema";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import { api, ApiError } from "@/lib/api-client";
import { departmentSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { Button, Field, inputClass } from "../ui";
import { Modal } from "../team/team-actions";
import { useToast } from "../toast";

type Dept = { id: string; name: string; code: string; description: string | null; categories: IssueCategory[]; email: string | null; phone: string | null; managerId: string | null; isActive: boolean };

export function DepartmentFormButton({ dept, managers }: { dept?: Dept; managers: { id: string; name: string; departmentName: string | null }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({
    name: dept?.name ?? "",
    code: dept?.code ?? "",
    description: dept?.description ?? "",
    categories: dept?.categories ?? ([] as IssueCategory[]),
    email: dept?.email ?? "",
    phone: dept?.phone ?? "",
    managerId: dept?.managerId ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...v, managerId: v.managerId || null, description: v.description || undefined };
    const parsed = departmentSchema.safeParse(payload);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      return setErrors(out);
    }
    setBusy(true);
    setErrors({});
    try {
      await api(dept ? `/api/departments/${dept.id}` : "/api/departments", { method: dept ? "PATCH" : "POST", json: payload });
      toast({ kind: "success", title: dept ? "Department updated" : "Department created" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast({ kind: "error", title: err.message });
      }
    } finally {
      setBusy(false);
    }
  }
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      {dept ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-200">
          <Pencil className="size-3.5" /> Edit
        </button>
      ) : (
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New department
        </Button>
      )}
      {open && (
        <Modal title={dept ? `Edit ${dept.name}` : "Create department"} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Name" error={errors.name} required><input className={inputClass} value={v.name} onChange={set("name")} /></Field>
              <Field label="Code" error={errors.code} required><input className={inputClass + " uppercase"} value={v.code} onChange={set("code")} maxLength={12} /></Field>
            </div>
            <Field label="Description" error={errors.description}><textarea rows={2} className={inputClass} value={v.description} onChange={set("description")} /></Field>
            <Field label="Handles categories" hint="New reports in these categories are routed here automatically.">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const on = v.categories.includes(c);
                  return (
                    <button key={c} type="button" onClick={() => setV((s) => ({ ...s, categories: on ? s.categories.filter((x) => x !== c) : [...s.categories, c] }))} className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-900/40 dark:text-accent-200" : "border-line text-muted")}>
                      {CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.email}><input type="email" className={inputClass} value={v.email} onChange={set("email")} /></Field>
              <Field label="Phone" error={errors.phone}><input className={inputClass} value={v.phone} onChange={set("phone")} /></Field>
            </div>
            <Field label="Department manager" error={errors.managerId} hint="Only users with the Department Manager role are listed.">
              <select className={inputClass} value={v.managerId} onChange={set("managerId")}>
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.departmentName ? ` (currently ${m.departmentName})` : ""}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={busy}>{dept ? "Save changes" : "Create"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function DepartmentActiveToggle({ id, isActive, name }: { id: string; isActive: boolean; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      className={cn("text-xs font-medium hover:underline disabled:opacity-50", isActive ? "text-rose-600" : "text-accent-600")}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/departments/${id}`, { method: "PATCH", json: { isActive: !isActive } });
          toast({ kind: "success", title: `${name} ${isActive ? "deactivated" : "reactivated"}` });
          router.refresh();
        } catch (e) {
          toast({ kind: "error", title: e instanceof ApiError ? e.message : "Failed" });
        } finally {
          setBusy(false);
        }
      }}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
