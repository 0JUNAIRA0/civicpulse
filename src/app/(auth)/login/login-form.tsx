"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation";

const DEMO = [
  { role: "Admin", email: "admin@civicpulse.gov", password: "Admin@123" },
  { role: "Department Manager", email: "manager.roads@civicpulse.gov", password: "Manager@123" },
  { role: "Maintenance Staff", email: "staff@civicpulse.gov", password: "Staff@123" },
  { role: "Citizen", email: "citizen@civicpulse.app", password: "Citizen@123" },
];

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setFormError("");
    const parsed = loginSchema.safeParse(creds ?? { email, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await api<{ redirectTo: string }>("/api/auth/login", { method: "POST", json: parsed.data });
      router.push(next ?? res.redirectTo);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not sign in");
      if (err instanceof ApiError) setErrors(err.fields);
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Use the email and password for your CivicPulse account.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {formError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" role="alert">{formError}</div>}
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <input id="password" type={show ? "text" : "password"} autoComplete="current-password" className={inputClass + " pr-10"} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-muted" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-medium text-accent-600 hover:underline">
          Create a citizen account
        </Link>
      </p>

      <div className="mt-8 border-t border-line pt-6">
        <p className="text-sm font-medium">Demo accounts</p>
        <p className="mt-0.5 text-xs text-muted">Click one to sign in with it.</p>
        <div className="mt-3 divide-y divide-line rounded-md border border-line">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail(d.email);
                setPassword(d.password);
                submit(undefined, d);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-2"
            >
              <span>
                <span className="block font-medium">{d.role}</span>
                <span className="block text-xs text-muted">{d.email} · {d.password}</span>
              </span>
              <span className="text-xs text-muted">Use</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
