import Link from "next/link";
import { sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LinkButton } from "@/components/ui";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS, WORKFLOW } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function publicStats() {
  try {
    const r = await db.execute<{ total: string; resolved: string; depts: string; hours: string | null }>(sql`
      SELECT (SELECT count(*) FROM issues) AS total,
             (SELECT count(*) FROM issues WHERE status IN ('RESOLVED','CLOSED')) AS resolved,
             (SELECT count(*) FROM departments WHERE is_active) AS depts,
             (SELECT avg(extract(epoch FROM (resolved_at - created_at))/86400) FROM issues WHERE resolved_at IS NOT NULL) AS hours`);
    const x = r.rows[0];
    return { total: Number(x.total), resolved: Number(x.resolved), depts: Number(x.depts), days: x.hours ? Number(x.hours) : null };
  } catch {
    return null;
  }
}

const STEPS = [
  { t: "Report", d: "A resident takes a photo, pins the location and describes the problem. Nearby duplicates are flagged before submitting." },
  { t: "Verify and assign", d: "The responsible department checks the report, sets a priority and hands it to a field crew with a due date." },
  { t: "Fix and confirm", d: "The crew logs progress with before and after photos. The department signs off and the resident rates the result." },
];

const ROLES = [
  { t: "Residents", d: "Report problems, follow progress and rate the repair." },
  { t: "Department managers", d: "Verify reports, set priorities, assign crews and review completed work." },
  { t: "Maintenance staff", d: "See assigned jobs, post progress updates and upload proof of work." },
  { t: "Administrators", d: "Manage departments, accounts and permissions, and see city-wide reports." },
];

export default async function Landing() {
  const stats = await publicStats();
  const numbers = [
    { k: "issues reported", v: stats?.total },
    { k: "resolved", v: stats?.resolved },
    { k: "departments", v: stats?.depts },
    { k: "average days to resolve", v: stats?.days != null ? stats.days.toFixed(1) : undefined },
  ];
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="ml-6 hidden gap-5 text-sm text-muted md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#roles" className="hover:text-ink">Roles</a>
            <Link href="/map" className="hover:text-ink">Map</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <LinkButton href="/login" variant="ghost" size="sm">Sign in</LinkButton>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
        <p className="text-sm font-medium text-accent-600 dark:text-accent-400">Dhaka City · Public works</p>
        <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-semibold text-brand-700 sm:text-[2.6rem] dark:text-white">
          Report broken roads, streetlights and drains, and follow them until they are fixed.
        </h1>
        <p className="mt-5 max-w-xl text-muted">
          CivicPulse sends each report to the department responsible for it, keeps a record of every step, and lets residents see what is being done.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/register" variant="primary">
            Report an issue <ArrowRight className="size-4" />
          </LinkButton>
          <LinkButton href="/login" variant="outline">Staff sign in</LinkButton>
        </div>
      </section>

      <section className="border-y border-line bg-bg">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4">
          {numbers.map((n, i) => (
            <div key={n.k} className={`py-6 ${i % 2 ? "pl-6" : ""} ${i > 0 ? "md:border-l md:border-line md:pl-6" : ""}`}>
              <dt className="text-sm text-muted">{n.k}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{n.v ?? "–"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-xl font-semibold text-ink">How it works</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="border-t-2 border-brand-700 pt-4 dark:border-brand-400">
              <p className="text-sm text-muted">Step {i + 1}</p>
              <h3 className="mt-1 font-semibold text-ink">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-muted">
          Status flow: {WORKFLOW.map((s) => STATUS_LABELS[s]).join(" → ")}
        </p>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold text-ink">What can be reported</h2>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {CATEGORIES.map((c) => (
              <li key={c} className="inline-flex items-center gap-2 text-sm text-ink">
                <span className="size-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} aria-hidden /> {CATEGORY_LABELS[c]}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="roles" className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold text-ink">Roles</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {ROLES.map((r) => (
              <div key={r.t} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr]">
                <dt className="font-medium text-ink">{r.t}</dt>
                <dd className="text-sm text-muted">{r.d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-sm text-muted">
            Demo accounts for each role are listed on the{" "}
            <Link href="/login" className="font-medium text-brand-700 underline underline-offset-4 dark:text-brand-200">sign-in page</Link>.
          </p>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <span>© {new Date().getFullYear()} CivicPulse</span>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
