import { getCurrentUser } from "@/server/auth";
import { listNotifications } from "@/server/services/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/notifications/stream — Server-Sent Events for real-time notifications.
 * Emits `notification` events for new rows and an `unread` count; the client reconnects automatically.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const encoder = new TextEncoder();
  let since = new Date();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const initial = await listNotifications(user.id, { limit: 1 });
      send("unread", { unread: initial.unread });
      const startedAt = Date.now();
      timer = setInterval(async () => {
        try {
          const { items, unread } = await listNotifications(user.id, { after: since, limit: 20 });
          if (items.length) {
            since = items[0].createdAt;
            for (const n of items.reverse()) send("notification", n);
            send("unread", { unread });
          } else controller.enqueue(encoder.encode(`: ping\n\n`));
          // Close before platform timeouts; EventSource reconnects on its own.
          if (Date.now() - startedAt > 240_000) {
            clearInterval(timer);
            controller.close();
          }
        } catch {
          clearInterval(timer);
          try {
            controller.close();
          } catch {}
        }
      }, 5000);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
