import { LinkButton } from "@/components/ui";
import { Logo } from "@/components/shell/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <Logo className="text-xl" />
        <p className="mt-8 text-6xl font-bold text-brand-700 dark:text-brand-200">404</p>
        <p className="mt-2 text-muted">We couldn&apos;t find that page.</p>
        <LinkButton href="/dashboard" className="mt-6">
          Go to dashboard
        </LinkButton>
      </div>
    </div>
  );
}
