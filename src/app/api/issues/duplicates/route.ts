import { z } from "zod";
import { route, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { findPossibleDuplicates } from "@/server/services/issues";
import { latitude, longitude } from "@/lib/validation";

const q = z.object({
  lat: latitude,
  lng: longitude,
  category: z.enum(["ROAD_DAMAGE", "STREETLIGHT", "DRAINAGE", "FOOTPATH", "WASTE_MANAGEMENT", "PUBLIC_INFRASTRUCTURE"]).optional(),
  title: z.string().max(140).optional(),
  description: z.string().max(4000).optional(),
  excludeId: z.uuid().optional(),
});

/** GET /api/issues/duplicates — similar open reports near a point (used live while reporting). */
export const GET = route(async (req) => {
  await requireApiUser();
  const p = q.parse(searchParamsObject(req));
  return { items: await findPossibleDuplicates({ latitude: p.lat, longitude: p.lng, category: p.category, title: p.title, description: p.description, excludeId: p.excludeId }) };
});
