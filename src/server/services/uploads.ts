import "server-only";
import { and, eq, inArray, notExists } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { issueAttachments, uploads } from "@/db/schema";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { badRequest } from "../errors";

/** Identify an image from its first bytes; never trust the client-provided MIME type. */
export function sniffImageType(buf: Buffer): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function saveUpload(ownerId: string, file: File) {
  if (!(file instanceof File)) throw badRequest("Attach an image file");
  if (file.size === 0) throw badRequest("The file is empty");
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest(`Images must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(buf);
  if (!mime) throw badRequest("Only JPEG, PNG or WebP images are allowed");
  const safeName = (file.name || "image").replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const [row] = await db
    .insert(uploads)
    .values({ ownerId, fileName: safeName, mimeType: mime, size: buf.length, data: buf })
    .returning({ id: uploads.id, mimeType: uploads.mimeType, size: uploads.size });
  return { ...row, url: `/api/uploads/${row.id}` };
}

/** Attach uploads (owned by the actor and not yet used) to an issue. */
export async function attachUploads(
  tx: Tx,
  opts: { issueId: string; uploadIds: string[]; kind: "REPORT" | "PROGRESS" | "COMPLETION"; actorId: string; taskId?: string },
) {
  const ids = [...new Set(opts.uploadIds)];
  if (!ids.length) return 0;
  const usable = await tx
    .select({ id: uploads.id })
    .from(uploads)
    .where(
      and(
        inArray(uploads.id, ids),
        eq(uploads.ownerId, opts.actorId),
        notExists(tx.select({ x: issueAttachments.id }).from(issueAttachments).where(eq(issueAttachments.uploadId, uploads.id))),
      ),
    );
  if (usable.length !== ids.length) throw badRequest("One or more images are invalid or already used. Please upload them again.");
  await tx.insert(issueAttachments).values(
    ids.map((uploadId) => ({
      issueId: opts.issueId,
      uploadId,
      kind: opts.kind,
      uploadedById: opts.actorId,
      taskId: opts.taskId,
    })),
  );
  return ids.length;
}

export async function getUpload(id: string) {
  return db.query.uploads.findFirst({ where: eq(uploads.id, id) });
}

