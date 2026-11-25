import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth";
import { listNotifications } from "@/server/services/notifications";
import { Card, PageHeader } from "@/components/ui";
import { NotificationsList } from "@/components/notifications-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const { items, unread } = await listNotifications(user.id, { limit: 100 });
  return (
    <>
      <PageHeader title="Notifications" description="Updates arrive in real time while you're signed in." />
      <Card>
        <NotificationsList items={items} unread={unread} />
      </Card>
    </>
  );
}
