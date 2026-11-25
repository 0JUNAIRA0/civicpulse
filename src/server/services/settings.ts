import "server-only";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { settingsSchema, type Settings } from "@/lib/validation";
import { logActivity } from "./activity";

export const DEFAULT_SETTINGS: Settings = {
  cityName: "Dhaka",
  mapCenter: { lat: 23.7808, lng: 90.4093, zoom: 12 },
  cityBounds: { north: 23.95, south: 23.66, east: 90.52, west: 90.3 },
  duplicateRadiusMeters: 150,
  allowCitizenRegistration: true,
  autoRouteToDepartment: true,
  reminderIntervalHours: 24,
  slaDays: { LOW: 21, MEDIUM: 10, HIGH: 4, CRITICAL: 1 },
  supportEmail: "support@civicpulse.gov",
};

const KEY = "platform";

export async function getSettings(): Promise<Settings> {
  const row = await db.query.systemSettings.findFirst({ where: (s, { eq }) => eq(s.key, KEY) });
  if (!row) return DEFAULT_SETTINGS;
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(row.value as object) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(value: Settings, actorId: string) {
  await db
    .insert(systemSettings)
    .values({ key: KEY, value, updatedById: actorId })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedById: actorId, updatedAt: new Date() } });
  await logActivity({ actorId, action: "settings.update", entityType: "settings", summary: "Updated system configuration" });
  return value;
}
