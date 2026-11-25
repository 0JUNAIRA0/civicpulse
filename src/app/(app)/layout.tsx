import { requirePageUser } from "@/server/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { NAV } from "@/components/shell/nav";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  const items = NAV[user.role];
  const roleLabel = ROLE_LABELS[user.role];
  return (
    <div className="min-h-screen">
      <Sidebar items={items} roleLabel={roleLabel} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <MobileNav items={items} roleLabel={roleLabel} />
          <div className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu name={user.name} email={user.email} roleLabel={roleLabel} avatarUrl={user.avatarUrl} />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
