import type { Role } from "@/db/schema";

export type NavItem = { href: string; label: string; icon: string; exact?: boolean };

export const NAV: Record<Role, NavItem[]> = {
  CITIZEN: [
    { href: "/citizen", label: "Dashboard", icon: "home", exact: true },
    { href: "/citizen/report/new", label: "Report an issue", icon: "plus" },
    { href: "/citizen/reports", label: "My reports", icon: "list" },
    { href: "/map", label: "City map", icon: "map" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/profile", label: "Profile", icon: "user" },
  ],
  STAFF: [
    { href: "/staff", label: "Dashboard", icon: "home", exact: true },
    { href: "/staff/tasks", label: "My tasks", icon: "wrench" },
    { href: "/map", label: "Task map", icon: "map" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/profile", label: "Profile", icon: "user" },
  ],
  DEPT_MANAGER: [
    { href: "/department", label: "Dashboard", icon: "home", exact: true },
    { href: "/department/issues", label: "Issue management", icon: "list" },
    { href: "/department/team", label: "Team management", icon: "users" },
    { href: "/map", label: "Map", icon: "map" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/profile", label: "Profile", icon: "user" },
  ],
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: "home", exact: true },
    { href: "/admin/analytics", label: "Analytics", icon: "chart" },
    { href: "/admin/issues", label: "All issues", icon: "list" },
    { href: "/admin/departments", label: "Departments", icon: "building" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/map", label: "Map", icon: "map" },
    { href: "/admin/settings", label: "System settings", icon: "settings" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/profile", label: "Profile", icon: "user" },
  ],
};
