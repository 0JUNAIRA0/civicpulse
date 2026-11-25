import { route, parseJson } from "@/server/api";
import { assertPermission, requireApiUser } from "@/server/auth";
import { getSettings, saveSettings } from "@/server/services/settings";
import { settingsSchema } from "@/lib/validation";

/** GET /api/settings — public-safe platform configuration for signed-in users. */
export const GET = route(async () => {
  await requireApiUser();
  return { settings: await getSettings() };
});

/** PUT /api/settings — admin updates system configuration. */
export const PUT = route(async (req) => {
  const user = await requireApiUser();
  assertPermission(user, "settings:manage");
  const input = await parseJson(req, settingsSchema);
  return { settings: await saveSettings(input, user.id) };
});
