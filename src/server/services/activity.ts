import "server-only";
import { db, type Tx } from "@/db";
import { activityLogs } from "@/db/schema";

export async function logActivity(
  e: { actorId: string | null; action: string; entityType: string; entityId?: string | null; summary: string; metadata?: Record<string, unknown> },
  tx: Tx | typeof db = db,
) {
  await tx.insert(activityLogs).values({
    actorId: e.actorId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId ?? null,
    summary: e.summary,
    metadata: e.metadata,
  });
}
