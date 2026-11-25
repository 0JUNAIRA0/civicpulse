"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Role } from "@/db/schema";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { GRANTABLE_PERMISSIONS, PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { api, ApiError } from "@/lib/api-client";
import { Button, Field, inputClass } from "../ui";
import { Modal } from "../team/team-actions";
import { useToast } from "../toast";

type U = { id: string; name: string; email: string; role: Role; departmentId: string | null; jobTitle: string | null; permissions: string[]; isActive: boolean };

export function EditUserButton({ user, departments, isSelf }: { user: U; departments: { id: string; name: string }[]; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({ name: user.name, role: user.role, departmentId: user.departmentId ?? "", jobTitle: user.jobTitle ?? "", permissions: user.permissions, isActive: user.isActive });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const needsDept = v.role === "STAFF" || v.role === "DEPT_MANAGER";
  const roleDefaults = new Set<string>(ROLE_PERMISSIONS[v.role]);

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      const body: Record<string, unknown> = { name: v.name, jobTitle: v.jobTitle || null, departmentId: needsDept ? v.departmentId || null : null };
      if (!isSelf) Object.assign(body, { role: v.role, permissions: v.permissions.filter((p) => !roleDefaults.has(p)), isActive: v.isActive });
      await api(`/api/users/${user.id}`, { method: "PATCH", json: body });
      toast({ kind: "success", title: `${v.name} updated` });
      setOpen(false);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        toast({ kind: "error", title: e.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-200">
        <Pencil className="size-3.5" /> Edit
      </button>
      {open && (
        <Modal title={`Edit ${user.name}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-muted">{user.email}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name}><input className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
              <Field label="Job title"><input className={inputClass} value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} /></Field>
              <Field label="Role" error={errors.role} hint={isSelf ? "You cannot change your own role" : undefined}>
                <select className={inputClass} value={v.role} disabled={isSelf} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </Field>
              {needsDept && (
                <Field label="Department" error={errors.departmentId}>
                  <select className={inputClass} value={v.departmentId} onChange={(e) => setV({ ...v, departmentId: e.target.value })}>
                    <option value="">Choose…</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
            {v.role !== "ADMIN" && !isSelf && (
              <Field label="Additional administrative permissions" hint="Granted on top of the role's defaults. Enforced on the server.">
                <div className="grid gap-2 sm:grid-cols-2">
                  {GRANTABLE_PERMISSIONS.map((p) => {
                    const inherited = roleDefaults.has(p);
                    const checked = inherited || v.permissions.includes(p);
                    return (
                      <label key={p} className="flex items-start gap-2 rounded-lg border border-line p-2 text-xs">
                        <input type="checkbox" className="mt-0.5 accent-[#00A6A6]" checked={checked} disabled={inherited} onChange={(e) => setV({ ...v, permissions: e.target.checked ? [...v.permissions, p] : v.permissions.filter((x) => x !== p) })} />
                        <span>
                          <span className="block font-medium">{PERMISSIONS[p]}</span>
                          <span className="font-mono text-[10px] text-muted">{p}{inherited ? " · from role" : ""}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Field>
            )}
            {!isSelf && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[#00A6A6]" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} /> Account active
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button loading={busy} onClick={save}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
