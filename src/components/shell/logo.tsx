export function LogoMark({ className = "size-7", light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill={light ? "#ffffff" : "#123B5D"} />
      <path d="M5.5 17.5h4.25l2.75-6.5 4.25 12 3.25-8.5 1.75 3H23" fill="none" stroke="#00A6A6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.5" cy="17.5" r="2.25" fill={light ? "#123B5D" : "#ffffff"} />
    </svg>
  );
}

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className}`}>
      <LogoMark light={light} />
      <span className={light ? "text-white" : "text-brand-700 dark:text-white"}>CivicPulse</span>
    </span>
  );
}
