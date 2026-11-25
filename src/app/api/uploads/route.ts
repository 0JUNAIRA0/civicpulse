import { route } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { AppError, badRequest } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { saveUpload } from "@/server/services/uploads";

/** POST /api/uploads — multipart/form-data with a single `file` field (JPEG/PNG/WebP, ≤ 5 MB). */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const rl = rateLimit(`upload:${user.id}`, 60, 60 * 60_000);
  if (!rl.ok) throw new AppError(429, "Upload limit reached, try again later", "RATE_LIMITED");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw badRequest("Attach an image in the `file` field");
  const saved = await saveUpload(user.id, file);
  return Response.json(saved, { status: 201 });
});
