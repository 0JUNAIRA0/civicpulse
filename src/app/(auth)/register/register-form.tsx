"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui";
import { PasswordStrength } from "@/components/password-strength";
import { api, ApiError } from "@/lib/api-client";
import { registerSchema } from "@/lib/validation";

export function RegisterForm({ city }: { city: string }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const parsed = registerSchema.safeParse(v);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      setErrors(out);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await api("/api/auth/register", { method: "POST", json: v });
      router.push("/citizen");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create the account");
      if (err instanceof ApiError) setErrors(err.fields);
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-muted">Join residents of {city} who help keep the city in shape.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {formError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" role="alert">{formError}</div>}
        <Field label="Full name" htmlFor="name" error={errors.name} required>
          <input id="name" autoComplete="name" className={inputClass} value={v.name} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email} required>
          <input id="email" type="email" autoComplete="email" className={inputClass} value={v.email} onChange={set("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone} hint="Optional, used only for follow-up on your reports">
          <input id="phone" type="tel" autoComplete="tel" className={inputClass} value={v.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} required>
          <input id="password" type="password" autoComplete="new-password" className={inputClass} value={v.password} onChange={set("password")} aria-invalid={!!errors.password} />
          <PasswordStrength value={v.password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
          <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClass} value={v.confirmPassword} onChange={set("confirmPassword")} aria-invalid={!!errors.confirmPassword} />
        </Field>
        <Button type="submit" className="w-full" variant="accent" loading={loading}>
          <UserPlus className="size-4" /> Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-accent-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
