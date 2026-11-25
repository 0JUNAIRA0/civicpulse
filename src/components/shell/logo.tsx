export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="5" fill={light ? "#ffffff" : "#123B5D"} />
        <path d="M4 13h3.5l2-4.5 3 9 2.2-6 1.1 1.5H20" fill="none" stroke="#00A6A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={light ? "text-white" : "text-brand-700 dark:text-white"}>CivicPulse</span>
    </span>
  );
}
