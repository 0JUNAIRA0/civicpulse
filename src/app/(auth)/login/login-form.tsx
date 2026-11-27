"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation";

const DEMO = [
  { role: "Admin", scope: "Departments, accounts, city-wide reports", email: "admin@civicpulse.gov", password: "Admin@123" },
  { role: "Department Manager", scope: "Verify, prioritise and assign issues", email: "manager.roads@civicpulse.gov", password: "Manager@123" },
  { role: "Maintenance Staff", scope: "Assigned jobs and proof of work", email: "staff@civicpulse.gov", password: "Staff@123" },
  { role: "Citizen", scope: "Report issues and follow progress", email: "citizen@civicpulse.app", password: "Citizen@123" },
];

const fieldInput = inputClass.replace("py-2", "h-11 py-0") + " aria-[invalid=true]:focus:ring-rose-500/20";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDemo, setPendingDemo] = useState<string | null>(null);

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
      setFormError(err instanceof ApiError ? err.message : "Could not sign in. Check your connection and try again.");
      if (err instanceof ApiError) setErrors(err.fields);
      setLoading(false);
      setPendingDemo(null);
    }
  }

  const trackCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  return (
    <div>
      <p className="font-mono text-[11px] tracking-[0.14em] text-accent-700 uppercase dark:text-accent-400">Account access</p>
      <h1 className="mt-2 text-[1.625rem] leading-tight font-semibold text-brand-700 dark:text-white">Sign in to CivicPulse</h1>
      <p className="mt-2 text-sm text-muted">Use the email and password registered to your account. Staff accounts are created by an administrator.</p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate aria-describedby={formError ? "login-error" : undefined}>
        {formError && (
          <div id="login-error" role="alert" className="flex gap-2.5 rounded-md border-l-[3px] border-rose-600 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            className={fieldInput}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
            }}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            disabled={loading}
          />
          {errors.email && (
            <p id="email-error" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              className={fieldInput + " pr-11"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
              }}
              onKeyDown={trackCaps}
              onKeyUp={trackCaps}
              onBlur={() => setCapsLock(false)}
              aria-invalid={!!errors.password}
              aria-describedby={[errors.password && "password-error", capsLock && "caps-hint"].filter(Boolean).join(" ") || undefined}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? (
            <p id="password-error" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {errors.password}
            </p>
          ) : capsLock ? (
            <p id="caps-hint" className="text-xs text-amber-700 dark:text-amber-400">
              Caps Lock is on.
            </p>
          ) : null}
        </div>

        <Button type="submit" className="h-11 w-full" loading={loading && !pendingDemo}>
          {loading && !pendingDemo ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Reporting a problem as a resident?{" "}
        <Link href="/register" className="font-medium text-accent-700 underline-offset-4 hover:underline dark:text-accent-400">
          Create a citizen account
        </Link>
      </p>

      <section aria-labelledby="demo-heading" className="mt-10">
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
          <h2 id="demo-heading" className="text-sm font-semibold text-ink">
            Demo accounts
          </h2>
          <span className="text-xs text-muted">One per role</span>
        </div>
        <ul className="divide-y divide-line">
          {DEMO.map((d) => {
            const busy = pendingDemo === d.email;
            return (
              <li key={d.email}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                    setPendingDemo(d.email);
                    submit(undefined, d);
                  }}
                  className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Sign in as ${d.role} (${d.email})`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{d.role}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{d.scope}</span>
                    <span className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px] text-muted">
                      <span className="break-all">{d.email}</span>
                      <span aria-hidden className="text-line">/</span>
                      <span>{d.password}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-700 dark:text-accent-400">
                    {busy ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Signing in
                      </>
                    ) : (
                      <>
                        Sign in <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
