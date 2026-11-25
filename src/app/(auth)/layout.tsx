import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:py-14">
        <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">{children}</div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-muted">CivicPulse · Infrastructure issue reporting</footer>
    </div>
  );
}
