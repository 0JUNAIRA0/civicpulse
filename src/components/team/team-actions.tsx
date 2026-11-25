"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import type { Role } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/constants";
import { api, ApiError } from "@/lib/api-client";
import { userCreateSchema } from "@/lib/validation";
import { Button, Card, Field, inputClass } from "../ui";
import { useToast } from "../toast";
import { PasswordStrength } from "../password-strength";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[900] grid place-items-center p-4" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="animate-slide-in relative max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </div>
  );
}

/** Create a user. Managers can only create staff for their own department (enforced on the server too). */
export function AddUserButton({ roles, departments, defaultRole, fixedDepartmentId, label = "Add user" }: { roles: Role[]; departments?: { id: string; name: string }[]; defaultRole: Role; fixedDepartmentId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({ name: "", email: "", phone: "", jobTitle: "", role: defaultRole as Role, departmentId: fixedDepartmentId ?? "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const needsDept = v.role === "STAFF" || v.role === "DEPT_MANAGER";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...v, departmentId: needsDept ? v.departmentId || null : null, jobTitle: v.jobTitle || undefined };
    const parsed = userCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      return setErrors(out);
    }
    if (needsDept && !payload.departmentId) return setErrors({ departmentId: "Choose a department" });
    setBusy(true);
    setErrors({});
    try {
      await api("/api/users", { method: "POST", json: payload });
      toast({ kind: "success", title: `${v.name} added`, message: `They can sign in with ${v.email}.` });
      setOpen(false);
      setV({ ...v, name: "", email: "", phone: "", jobTitle: "", password: "" });
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
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="accent">
        <UserPlus className="size-4" /> {label}
      </Button>
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name} required><input className={inputClass} value={v.name} onChange={set("name")} /></Field>
              <Field label="Email" error={errors.email} required><input type="email" className={inputClass} value={v.email} onChange={set("email")} /></Field>
              <Field label="Phone" error={errors.phone}><input className={inputClass} value={v.phone} onChange={set("phone")} /></Field>
              <Field label="Job title" error={errors.jobTitle}><input className={inputClass} value={v.jobTitle} onChange={set("jobTitle")} placeholder="Field Technician" /></Field>
              {roles.length > 1 && (
                <Field label="Role" error={errors.role} required>
                  <select className={inputClass} value={v.role} onChange={set("role")}>
                    {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </Field>
              )}
              {needsDept && !fixedDepartmentId && departments && (
                <Field label="Department" error={errors.departmentId} required>
                  <select className={inputClass} value={v.departmentId} onChange={set("departmentId")}>
                    <option value="">Choose…</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
            <Field label="Temporary password" error={errors.password} required hint="Share it securely; they can change it in Profile.">
              <input type="text" className={inputClass} value={v.password} onChange={set("password")} autoComplete="off" />
              <PasswordStrength value={v.password} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={busy}>Create</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ToggleActiveButton({ userId, isActive, name }: { userId: string; isActive: boolean; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/users/${userId}`, { method: "PATCH", json: { isActive: !isActive } });
          toast({ kind: "success", title: `${name} ${isActive ? "deactivated" : "reactivated"}` });
          router.refresh();
        } catch (e) {
          toast({ kind: "error", title: e instanceof ApiError ? e.message : "Failed" });
        } finally {
          setBusy(false);
        }
      }}
      className={isActive ? "text-xs font-medium text-rose-600 hover:underline disabled:opacity-50" : "text-xs font-medium text-accent-600 hover:underline disabled:opacity-50"}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
