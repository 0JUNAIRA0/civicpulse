import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  customType,
  index,
  uniqueIndex,
  type AnyPgColumn,
  check,
  pgSequence,
} from "drizzle-orm/pg-core";

export const issueRefSeq = pgSequence("issue_ref_seq", { startWith: 1001 });

/* ----------------------------------------------------------------------------
 * Enums
 * --------------------------------------------------------------------------*/
export const roleEnum = pgEnum("user_role", ["ADMIN", "DEPT_MANAGER", "STAFF", "CITIZEN"]);

export const issueStatusEnum = pgEnum("issue_status", [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
]);

export const issueCategoryEnum = pgEnum("issue_category", [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "DRAINAGE",
  "FOOTPATH",
  "WASTE_MANAGEMENT",
  "PUBLIC_INFRASTRUCTURE",
]);

export const priorityEnum = pgEnum("issue_priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const taskStatusEnum = pgEnum("task_status", [
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "APPROVED",
  "REWORK",
  "CANCELLED",
]);

export const taskUpdateTypeEnum = pgEnum("task_update_type", ["PROGRESS", "NOTE", "STATUS", "REVIEW"]);

export const attachmentKindEnum = pgEnum("attachment_kind", ["REPORT", "PROGRESS", "COMPLETION"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "ISSUE_STATUS",
  "TASK_ASSIGNED",
  "TASK_UPDATE",
  "TASK_REVIEW",
  "REMINDER",
  "FEEDBACK",
  "SYSTEM",
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ----------------------------------------------------------------------------
 * Departments
 * --------------------------------------------------------------------------*/
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 12 }).notNull(),
    description: text("description"),
    categories: issueCategoryEnum("categories").array().notNull().default(sql`'{}'::issue_category[]`),
    email: varchar("email", { length: 160 }),
    phone: varchar("phone", { length: 40 }),
    managerId: uuid("manager_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("departments_code_idx").on(t.code), uniqueIndex("departments_name_idx").on(t.name)],
);

/* ----------------------------------------------------------------------------
 * Users
 * --------------------------------------------------------------------------*/
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("CITIZEN"),
    phone: varchar("phone", { length: 40 }),
    address: text("address"),
    avatarUrl: text("avatar_url"),
    jobTitle: varchar("job_title", { length: 120 }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    /** Extra fine-grained permissions granted by an admin on top of the role defaults. */
    permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
    isActive: boolean("is_active").notNull().default(true),
    /** Incremented on password change / deactivation to revoke existing sessions. */
    sessionVersion: integer("session_version").notNull().default(1),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_idx").on(sql`lower(${t.email})`),
    index("users_role_idx").on(t.role),
    index("users_department_idx").on(t.departmentId),
  ],
);

/* ----------------------------------------------------------------------------
 * Areas (sample locations / wards)
 * --------------------------------------------------------------------------*/
export const areas = pgTable(
  "areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    zone: varchar("zone", { length: 60 }).notNull(),
    ward: varchar("ward", { length: 20 }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("areas_name_idx").on(t.name)],
);

/* ----------------------------------------------------------------------------
 * Uploads (images stored in PostgreSQL so the app needs no extra storage service)
 * --------------------------------------------------------------------------*/
export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  fileName: varchar("file_name", { length: 200 }).notNull(),
  mimeType: varchar("mime_type", { length: 60 }).notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Issues
 * --------------------------------------------------------------------------*/
export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceCode: varchar("reference_code", { length: 20 }).notNull(),
    title: varchar("title", { length: 140 }).notNull(),
    description: text("description").notNull(),
    category: issueCategoryEnum("category").notNull(),
    priority: priorityEnum("priority"),
    status: issueStatusEnum("status").notNull().default("SUBMITTED"),
    address: varchar("address", { length: 255 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    areaId: uuid("area_id").references(() => areas.id, { onDelete: "set null" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    /** Set when a manager confirms this report duplicates another one. */
    duplicateOfId: uuid("duplicate_of_id").references((): AnyPgColumn => issues.id, { onDelete: "set null" }),
    /** Set automatically at submission when a nearby similar report exists. */
    suspectedDuplicateOfId: uuid("suspected_duplicate_of_id").references((): AnyPgColumn => issues.id, {
      onDelete: "set null",
    }),
    verifiedById: uuid("verified_by_id").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("issues_reference_idx").on(t.referenceCode),
    index("issues_status_idx").on(t.status),
    index("issues_category_idx").on(t.category),
    index("issues_priority_idx").on(t.priority),
    index("issues_department_idx").on(t.departmentId),
    index("issues_reporter_idx").on(t.reporterId),
    index("issues_area_idx").on(t.areaId),
    index("issues_created_idx").on(t.createdAt),
    index("issues_geo_idx").on(t.latitude, t.longitude),
    check("issues_lat_check", sql`${t.latitude} BETWEEN -90 AND 90`),
    check("issues_lng_check", sql`${t.longitude} BETWEEN -180 AND 180`),
  ],
);

export const issueAttachments = pgTable(
  "issue_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references((): AnyPgColumn => tasks.id, { onDelete: "set null" }),
    kind: attachmentKindEnum("kind").notNull().default("REPORT"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    caption: varchar("caption", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_issue_idx").on(t.issueId)],
);

/** Immutable audit trail of every status change. Rows are never updated or deleted by the app. */
export const issueStatusHistory = pgTable(
  "issue_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    fromStatus: issueStatusEnum("from_status"),
    toStatus: issueStatusEnum("to_status").notNull(),
    changedById: uuid("changed_by_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("history_issue_idx").on(t.issueId, t.createdAt)],
);

/* ----------------------------------------------------------------------------
 * Maintenance tasks
 * --------------------------------------------------------------------------*/
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedById: uuid("assigned_by_id").references(() => users.id, { onDelete: "set null" }),
    status: taskStatusEnum("status").notNull().default("ASSIGNED"),
    instructions: text("instructions"),
    progress: integer("progress").notNull().default(0),
    dueDate: timestamp("due_date", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("tasks_issue_idx").on(t.issueId),
    index("tasks_assignee_idx").on(t.assigneeId, t.status),
    check("tasks_progress_check", sql`${t.progress} BETWEEN 0 AND 100`),
  ],
);

export const taskUpdates = pgTable(
  "task_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    type: taskUpdateTypeEnum("type").notNull().default("NOTE"),
    message: text("message").notNull(),
    progress: integer("progress"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_updates_task_idx").on(t.taskId, t.createdAt)],
);

/* ----------------------------------------------------------------------------
 * Citizen feedback
 * --------------------------------------------------------------------------*/
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    citizenId: uuid("citizen_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("feedback_issue_idx").on(t.issueId), check("feedback_rating_check", sql`${t.rating} BETWEEN 1 AND 5`)],
);

/* ----------------------------------------------------------------------------
 * Notifications, activity log, settings
 * --------------------------------------------------------------------------*/
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull().default("SYSTEM"),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    link: varchar("link", { length: 255 }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.isRead, t.createdAt)],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_entity_idx").on(t.entityType, t.entityId), index("activity_created_idx").on(t.createdAt)],
);

export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Relations
 * --------------------------------------------------------------------------*/
export const departmentsRelations = relations(departments, ({ one, many }) => ({
  manager: one(users, { fields: [departments.managerId], references: [users.id], relationName: "manager" }),
  members: many(users, { relationName: "members" }),
  issues: many(issues),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
    relationName: "members",
  }),
  reportedIssues: many(issues, { relationName: "reporter" }),
  tasks: many(tasks, { relationName: "assignee" }),
  notifications: many(notifications),
}));

export const areasRelations = relations(areas, ({ many }) => ({ issues: many(issues) }));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  reporter: one(users, { fields: [issues.reporterId], references: [users.id], relationName: "reporter" }),
  department: one(departments, { fields: [issues.departmentId], references: [departments.id] }),
  area: one(areas, { fields: [issues.areaId], references: [areas.id] }),
  verifiedBy: one(users, { fields: [issues.verifiedById], references: [users.id], relationName: "verifier" }),
  duplicateOf: one(issues, { fields: [issues.duplicateOfId], references: [issues.id], relationName: "duplicate" }),
  suspectedDuplicateOf: one(issues, {
    fields: [issues.suspectedDuplicateOfId],
    references: [issues.id],
    relationName: "suspected",
  }),
  attachments: many(issueAttachments),
  history: many(issueStatusHistory),
  tasks: many(tasks),
  feedback: many(feedback),
}));

export const issueAttachmentsRelations = relations(issueAttachments, ({ one }) => ({
  issue: one(issues, { fields: [issueAttachments.issueId], references: [issues.id] }),
  upload: one(uploads, { fields: [issueAttachments.uploadId], references: [uploads.id] }),
  task: one(tasks, { fields: [issueAttachments.taskId], references: [tasks.id] }),
  uploadedBy: one(users, { fields: [issueAttachments.uploadedById], references: [users.id] }),
}));

export const issueStatusHistoryRelations = relations(issueStatusHistory, ({ one }) => ({
  issue: one(issues, { fields: [issueStatusHistory.issueId], references: [issues.id] }),
  changedBy: one(users, { fields: [issueStatusHistory.changedById], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  issue: one(issues, { fields: [tasks.issueId], references: [issues.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id], relationName: "assignee" }),
  assignedBy: one(users, { fields: [tasks.assignedById], references: [users.id], relationName: "assigner" }),
  updates: many(taskUpdates),
  attachments: many(issueAttachments),
}));

export const taskUpdatesRelations = relations(taskUpdates, ({ one }) => ({
  task: one(tasks, { fields: [taskUpdates.taskId], references: [tasks.id] }),
  author: one(users, { fields: [taskUpdates.authorId], references: [users.id] }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  issue: one(issues, { fields: [feedback.issueId], references: [issues.id] }),
  citizen: one(users, { fields: [feedback.citizenId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  actor: one(users, { fields: [activityLogs.actorId], references: [users.id] }),
}));

export type Role = (typeof roleEnum.enumValues)[number];
export type IssueStatus = (typeof issueStatusEnum.enumValues)[number];
export type IssueCategory = (typeof issueCategoryEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Task = typeof tasks.$inferSelect;
