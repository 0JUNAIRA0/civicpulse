"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, KeyRound, Save } from "lucide-react";
import { api, ApiError, uploadImage } from "@/lib/api-client";
import { passwordChangeSchema, profileSchema } from "@/lib/validation";
import { Avatar, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { PasswordStrength } from "./password-strength";
import { useToast } from "./toast";

export function ProfileForm({ user }: { user: { name: string; email: string; phone: string | null; address: string | null; avatarUrl: string | null } }) {
  const [v, setV] = useState({ name: user.name, phone: user.phone ?? "", address: user.address ?? "" });
  const [avatar, setAvatar] = useState<{ id?: string; url: string | null }>({ url: user.avatarUrl });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Personal information" />
      <form
        className="space-y-4 p-5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const payload = { ...v, address: v.address || undefined, avatarUploadId: avatar.id };
          const parsed = profileSchema.safeParse(payload);
          if (!parsed.success) {
            const out: Record<string, string> = {};
            for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
            return setErrors(out);
          }
          setBusy(true);
          setErrors({});
          try {
            await api("/api/profile", { method: "PATCH", json: payload });
            toast({ kind: "success", title: "Profile updated" });
            router.refresh();
          } catch (err) {
            if (err instanceof ApiError) {
              setErrors(err.fields);
              toast({ kind: "error", title: err.message });
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={v.name || user.name} src={avatar.url} size={64} />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2">
            <Camera className="size-4" /> Change photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const up = await uploadImage(f);
                  setAvatar({ id: up.id, url: URL.createObjectURL(f) });
                } catch (err) {
                  toast({ kind: "error", title: err instanceof ApiError ? err.message : "Upload failed" });
                }
              }}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.name} required><input className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Email" hint="Contact an administrator to change your email"><input className={inputClass} value={user.email} disabled /></Field>
          <Field label="Phone" error={errors.phone}><input className={inputClass} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Address" error={errors.address}><input className={inputClass} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={busy}><Save className="size-4" /> Save</Button>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Card>
      <CardHeader title="Password & security" description="Changing your password signs you out on other devices." />
      <form
        className="space-y-4 p-5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = passwordChangeSchema.safeParse(v);
          if (!parsed.success) {
            const out: Record<string, string> = {};
            for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
            return setErrors(out);
          }
          setBusy(true);
          setErrors({});
          try {
            await api("/api/profile/password", { method: "POST", json: v });
            toast({ kind: "success", title: "Password changed" });
            setV({ currentPassword: "", newPassword: "", confirmPassword: "" });
          } catch (err) {
            if (err instanceof ApiError) {
              setErrors(err.fields);
              toast({ kind: "error", title: err.message });
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Current password" error={errors.currentPassword} required><input type="password" autoComplete="current-password" className={inputClass} value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} /></Field>
        <Field label="New password" error={errors.newPassword} required>
          <input type="password" autoComplete="new-password" className={inputClass} value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} />
          <PasswordStrength value={v.newPassword} />
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword} required><input type="password" autoComplete="new-password" className={inputClass} value={v.confirmPassword} onChange={(e) => setV({ ...v, confirmPassword: e.target.value })} /></Field>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={busy}><KeyRound className="size-4" /> Update password</Button>
        </div>
      </form>
    </Card>
  );
}
