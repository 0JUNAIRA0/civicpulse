import { z } from "zod";
import { route } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { notFound } from "@/server/errors";
import { getUpload } from "@/server/services/uploads";

/** GET /api/uploads/:id — serves an image to signed-in users. */
export const GET = route<{ id: string }>(async (_req, ctx) => {
  await requireApiUser();
  const parsed = z.uuid().safeParse((await ctx.params).id);
  if (!parsed.success) throw notFound();
  const up = await getUpload(parsed.data);
  if (!up) throw notFound("Image not found");
  return new Response(new Uint8Array(up.data), {
    headers: {
      "Content-Type": up.mimeType,
      "Content-Length": String(up.size),
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
