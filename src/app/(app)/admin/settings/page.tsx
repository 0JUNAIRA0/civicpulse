import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth";
import { getSettings } from "@/server/services/settings";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "System settings" };

export default async function SettingsPage() {
  await requirePageUser(["ADMIN"]);
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="System settings" description="Platform-wide configuration. Changes apply immediately." />
      <SettingsForm initial={settings} />
    </>
  );
}
