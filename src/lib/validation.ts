import { z } from "zod";
import { ALL_PERMISSIONS } from "./permissions";

const categories = ["ROAD_DAMAGE", "STREETLIGHT", "DRAINAGE", "FOOTPATH", "WASTE_MANAGEMENT", "PUBLIC_INFRASTRUCTURE"] as const;
const statuses = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const roles = ["ADMIN", "DEPT_MANAGER", "STAFF", "CITIZEN"] as const;

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

const phone = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{6,20}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.email("Enter a valid email").trim().toLowerCase().max(160),
    phone,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const loginSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

export const latitude = z.coerce.number().refine((n) => Number.isFinite(n) && n >= -90 && n <= 90, "Latitude must be between -90 and 90");
export const longitude = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n >= -180 && n <= 180, "Longitude must be between -180 and 180");

export const createIssueSchema = z.object({
  title: z.string().trim().min(8, "Title should be at least 8 characters").max(140),
  description: z.string().trim().min(20, "Describe the problem in at least 20 characters").max(4000),
  category: z.enum(categories, "Choose a category"),
  address: z.string().trim().min(5, "Enter the location address").max(255),
  latitude,
  longitude,
  areaId: z.uuid().optional().nullable(),
  imageIds: z.array(z.uuid()).min(1, "Attach at least one photo").max(5, "Attach at most 5 photos"),
});

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(8).max(140).optional(),
    description: z.string().trim().min(20).max(4000).optional(),
    address: z.string().trim().min(5).max(255).optional(),
    priority: z.enum(priorities).optional(),
    departmentId: z.uuid().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "Nothing to update");

export const statusChangeSchema = z.object({
  status: z.enum(statuses),
  note: z.string().trim().max(1000).optional(),
});

export const verifySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), priority: z.enum(priorities), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5, "Give a reason").max(1000) }),
  z.object({
    action: z.literal("duplicate"),
    duplicateOfId: z.uuid("Choose the original issue"),
    note: z.string().trim().max(1000).optional(),
  }),
]);

export const assignSchema = z.object({
  assigneeId: z.uuid("Choose a staff member"),
  dueDate: z.coerce.date().optional(),
  instructions: z.string().trim().max(2000).optional(),
  priority: z.enum(priorities).optional(),
});

export const taskStatusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  note: z.string().trim().max(2000).optional(),
  completionImageIds: z.array(z.uuid()).max(5).optional(),
});

export const taskUpdateSchema = z.object({
  type: z.enum(["PROGRESS", "NOTE"]),
  message: z.string().trim().min(3, "Write a short note").max(2000),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  imageIds: z.array(z.uuid()).max(5).optional(),
});

export const taskReviewSchema = z.object({
  decision: z.enum(["approve", "rework"]),
  note: z.string().trim().max(2000).optional(),
});

export const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,12}$/, "2–12 letters, digits or dashes"),
  description: z.string().trim().max(1000).optional(),
  categories: z.array(z.enum(categories)).default([]),
  email: z.email().optional().or(z.literal("").transform(() => undefined)),
  phone,
  managerId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  role: z.enum(roles),
  departmentId: z.uuid().nullable().optional(),
  phone,
  jobTitle: z.string().trim().max(120).optional(),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(roles).optional(),
  departmentId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  phone,
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone,
  address: z.string().trim().max(255).optional(),
  avatarUploadId: z.uuid().optional().nullable(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: "Choose a new password" });

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const issueQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(statuses).optional().catch(undefined),
  statusGroup: z.enum(["open", "done"]).optional().catch(undefined),
  category: z.enum(categories).optional().catch(undefined),
  priority: z.enum([...priorities, "NONE"]).optional().catch(undefined),
  departmentId: z.uuid().optional().catch(undefined),
  areaId: z.uuid().optional().catch(undefined),
  from: dateParam,
  to: dateParam,
  sort: z.enum(["createdAt", "updatedAt", "priority", "status", "title", "category"]).default("createdAt").catch("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10).catch(10),
  mine: z
    .enum(["1", "true"])
    .optional()
    .transform((v) => !!v)
    .catch(false),
});
export type IssueQuery = z.infer<typeof issueQuerySchema>;

export const settingsSchema = z.object({
  cityName: z.string().trim().min(2).max(80),
  mapCenter: z.object({ lat: latitude, lng: longitude, zoom: z.coerce.number().int().min(3).max(18) }),
  cityBounds: z
    .object({ north: latitude, south: latitude, east: longitude, west: longitude })
    .refine((b) => b.north > b.south && b.east > b.west, "North must exceed south and east must exceed west"),
  duplicateRadiusMeters: z.coerce.number().int().min(20).max(2000),
  allowCitizenRegistration: z.boolean(),
  autoRouteToDepartment: z.boolean(),
  reminderIntervalHours: z.coerce.number().int().min(1).max(168),
  slaDays: z.object({
    LOW: z.coerce.number().int().min(1).max(90),
    MEDIUM: z.coerce.number().int().min(1).max(90),
    HIGH: z.coerce.number().int().min(1).max(90),
    CRITICAL: z.coerce.number().int().min(1).max(90),
  }),
  supportEmail: z.email(),
});
export type Settings = z.infer<typeof settingsSchema>;
