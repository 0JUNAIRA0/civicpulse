"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cp-theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button onClick={toggle} className={`grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink ${className}`} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title="Toggle dark mode">
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
