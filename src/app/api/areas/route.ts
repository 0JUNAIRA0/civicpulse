import { asc } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { route } from "@/server/api";

/** GET /api/areas — the city's sample locations / wards (public). */
export const GET = route(async () => ({ items: await db.select().from(areas).orderBy(asc(areas.name)) }));
