import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { STATUS_LABELS, WORKFLOW } from "@/lib/constants";
import type { IssueStatus } from "@/db/schema";

// Who acts at each stage of an issue's life in CivicPulse.
const STAGE_OWNER: Partial<Record<IssueStatus, string>> = {
  SUBMITTED: "Resident",
  UNDER_REVIEW: "Department",
  ASSIGNED: "Department",
  IN_PROGRESS: "Field crew",
  RESOLVED: "Department",
  CLOSED: "Resident",
};

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Context panel: what the system is and how a report moves through it. */}
      <aside className="relative hidden overflow-hidden bg-brand-700 lg:sticky lg:top-0 lg:h-screen text-brand-100 lg:flex lg:flex-col dark:bg-brand-950">
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-white opacity-[0.06]">
          <defs>
            <pattern id="cp-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cp-grid)" />
        </svg>
        <div className="relative flex flex-1 flex-col overflow-y-auto px-10 py-9 xl:px-14">
          <Link href="/" className="w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-300">
            <Logo light />
          </Link>

          <div className="mt-auto max-w-md pt-12">
            <p className="font-mono text-[11px] tracking-[0.14em] text-accent-300 uppercase">Public works · Issue tracking</p>
            <h2 className="mt-4 text-[1.75rem] leading-[1.2] font-semibold text-balance text-white xl:text-[2rem]">
              One record for every report, from the first photo to the final sign-off.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-brand-200">
              Residents, departments and maintenance crews work from the same case file, so nobody has to ask where a repair stands.
            </p>
          </div>

          <div className="mt-10 max-w-md">
            <p className="font-mono text-[11px] tracking-[0.14em] text-brand-300 uppercase">Issue lifecycle</p>
            <ol className="mt-4 border-l border-white/15">
              {WORKFLOW.map((s, i) => (
                <li key={s} className="relative flex items-baseline justify-between gap-4 py-[7px] pl-5">
                  <span
                    aria-hidden
                    className={`absolute top-1/2 -left-[4.5px] size-2 -translate-y-1/2 rounded-full ${
                      i === WORKFLOW.length - 1 ? "bg-accent-400" : "border border-brand-300 bg-brand-700 dark:bg-brand-950"
                    }`}
                  />
                  <span className="text-sm text-white">
                    <span className="mr-3 font-mono text-[11px] text-brand-300 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    {STATUS_LABELS[s]}
                  </span>
                  <span className="text-xs text-brand-300">{STAGE_OWNER[s]}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-10 border-t border-white/10 pt-5 text-xs text-brand-300">
            CivicPulse · Infrastructure issue reporting for citizens, departments and maintenance teams.
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="rounded lg:invisible">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-5 pt-4 pb-12 sm:px-8 sm:pt-10 lg:items-center lg:pt-0">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="px-5 py-5 text-xs text-muted sm:px-8 lg:hidden">CivicPulse · Infrastructure issue reporting</footer>
      </div>
    </div>
  );
}
