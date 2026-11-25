import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { getSettings } from "@/server/services/settings";
import { PageHeader } from "@/components/ui";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = { title: "Issue map" };

export default async function MapPage() {
  const user = await requirePageUser();
  const [settings, areaRows] = await Promise.all([getSettings(), db.select({ id: areas.id, name: areas.name, zone: areas.zone }).from(areas).orderBy(asc(areas.name))]);
  const scopeLabel = user.role === "CITIZEN" ? "My reports" : user.role === "STAFF" ? "My tasks" : user.role === "DEPT_MANAGER" ? "My department" : undefined;
  return (
    <>
      <PageHeader title={`${settings.cityName} issue map`} description="Every reported issue with category markers, heatmap, area filters and nearby search." />
      <MapExplorer center={[settings.mapCenter.lat, settings.mapCenter.lng]} zoom={settings.mapCenter.zoom} areas={areaRows} canScope={scopeLabel} defaultScope={user.role === "STAFF" || user.role === "DEPT_MANAGER" ? "mine" : "all"} />
    </>
  );
}
