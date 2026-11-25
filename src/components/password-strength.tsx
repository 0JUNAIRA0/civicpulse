"use client";
import { cn } from "@/lib/utils";

const RULES = [
  { test: (s: string) => s.length >= 8, label: "8+ characters" },
  { test: (s: string) => /[A-Z]/.test(s), label: "Uppercase" },
  { test: (s: string) => /[a-z]/.test(s), label: "Lowercase" },
  { test: (s: string) => /[0-9]/.test(s), label: "Number" },
  { test: (s: string) => /[^A-Za-z0-9]/.test(s), label: "Symbol (bonus)" },
];

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score = RULES.filter((r) => r.test(value)).length;
  const colors = ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-amber-500", "bg-accent-500", "bg-emerald-500"];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {RULES.map((_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < score ? colors[score] : "bg-line")} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {RULES.map((r) => (
          <span key={r.label} className={cn("text-[11px]", r.test(value) ? "text-accent-600" : "text-muted")}>
            {r.test(value) ? "✓" : "·"} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
