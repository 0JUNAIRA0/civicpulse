import { z } from "zod";
import { route, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { nearbyIssues } from "@/server/services/issues";
import { latitude, longitude } from "@/lib/validation";

const q = z.object({ lat: latitude, lng: longitude, radius: z.coerce.number().int().min(50).max(5000).default(1000) });

/** GET /api/issues/nearby?lat&lng&radius — issues within a radius (metres), nearest first. */
export const GET = route(async (req) => {
  await requireApiUser();
  const p = q.parse(searchParamsObject(req));
  return { items: await nearbyIssues(p.lat, p.lng, p.radius) };
});
