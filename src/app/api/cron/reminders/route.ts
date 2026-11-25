import { route } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { forbidden } from "@/server/errors";
import { getSettings } from "@/server/services/settings";
import { sendMaintenanceReminders } from "@/server/services/tasks";

/**
 * GET|POST /api/cron/reminders — automated maintenance reminders.
 * Called by a scheduler with `Authorization: Bearer $CRON_SECRET`, or manually by an admin.
 */
async function run(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const viaSecret = !!secret && auth === `Bearer ${secret}`;
  if (!viaSecret) {
    const user = await getCurrentUser();
    if (user?.role !== "ADMIN") throw forbidden();
  }
  const { reminderIntervalHours } = await getSettings();
  return sendMaintenanceReminders(reminderIntervalHours);
}
export const GET = route(run);
export const POST = route(run);
