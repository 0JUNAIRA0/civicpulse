import type { IssueCategory, IssueStatus, Priority, Role, TaskStatus } from "@/db/schema";

export const APP_NAME = "CivicPulse";

export const ROLES: Role[] = ["ADMIN", "DEPT_MANAGER", "STAFF", "CITIZEN"];
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  DEPT_MANAGER: "Department Manager",
  STAFF: "Maintenance Staff",
  CITIZEN: "Citizen",
};

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  DEPT_MANAGER: "/department",
  STAFF: "/staff",
  CITIZEN: "/citizen",
};

export const CATEGORIES: IssueCategory[] = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "DRAINAGE",
  "FOOTPATH",
  "WASTE_MANAGEMENT",
  "PUBLIC_INFRASTRUCTURE",
];

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  ROAD_DAMAGE: "Road Damage",
  STREETLIGHT: "Streetlight",
  DRAINAGE: "Drainage",
  FOOTPATH: "Footpath",
  WASTE_MANAGEMENT: "Waste Management",
  PUBLIC_INFRASTRUCTURE: "Public Infrastructure",
};

/** Marker / chart colour per category. Chosen to stay distinguishable next to the brand blue and teal. */
export const CATEGORY_COLORS: Record<IssueCategory, string> = {
  ROAD_DAMAGE: "#D9480F",
  STREETLIGHT: "#E8A400",
  DRAINAGE: "#1C7ED6",
  FOOTPATH: "#7048E8",
  WASTE_MANAGEMENT: "#2F9E44",
  PUBLIC_INFRASTRUCTURE: "#00A6A6",
};

export const STATUSES: IssueStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

/** The main happy-path workflow shown in progress trackers. REJECTED is a side branch. */
export const WORKFLOW: IssueStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

export const STATUS_STYLES: Record<IssueStatus, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600",
  UNDER_REVIEW: "bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  ASSIGNED: "bg-sky-50 text-sky-800 ring-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  IN_PROGRESS: "bg-indigo-50 text-indigo-800 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-indigo-800",
  RESOLVED: "bg-teal-50 text-teal-800 ring-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-800",
  CLOSED: "bg-emerald-50 text-emerald-800 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
};

export const OPEN_STATUSES: IssueStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"];
export const DONE_STATUSES: IssueStatus[] = ["RESOLVED", "CLOSED"];

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
export const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  CRITICAL: "bg-red-600 text-white dark:bg-red-700",
};
/** Days allowed to resolve, per priority. Drives due dates and automated reminders. */
export const PRIORITY_SLA_DAYS: Record<Priority, number> = { LOW: 21, MEDIUM: 10, HIGH: 4, CRITICAL: 1 };

export const TASK_STATUSES: TaskStatus[] = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "APPROVED", "REWORK", "CANCELLED"];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Awaiting Review",
  APPROVED: "Approved",
  REWORK: "Rework Requested",
  CANCELLED: "Cancelled",
};
export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["ASSIGNED", "IN_PROGRESS", "REWORK"];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const DUPLICATE_RADIUS_METERS = 150;
export const DEFAULT_PAGE_SIZE = 10;
