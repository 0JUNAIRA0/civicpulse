import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { getSettings } from "@/server/services/settings";
import { PageHeader } from "@/components/ui";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewReportPage() {
  await requirePageUser(["CITIZEN"]);
  const [settings, areaRows] = await Promise.all([getSettings(), db.select().from(areas).orderBy(asc(areas.name))]);
  return (
    <>
      <PageHeader title="Report an issue" description={`Tell us about a public infrastructure problem in ${settings.cityName}.`} />
      <ReportForm
        areas={areaRows.map((a) => ({ id: a.id, name: a.name, zone: a.zone, latitude: a.latitude, longitude: a.longitude }))}
        center={[settings.mapCenter.lat, settings.mapCenter.lng]}
        bounds={settings.cityBounds}
        city={settings.cityName}
      />
    </>
  );
}
