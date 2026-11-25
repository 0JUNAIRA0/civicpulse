import { z } from "zod";
import { route } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { AppError } from "@/server/errors";

const query = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

/** Small in-memory cache so repeated pins on the same spot do not hit the public geocoder again. */
const cache = new Map<string, { address: string; at: number }>();
const TTL = 24 * 3600_000;

/**
 * GET /api/geocode/reverse?lat=..&lng=..
 * Turns a map pin into a readable street address using OpenStreetMap Nominatim (free, no API key).
 * Proxied through the server so the usage policy (identifying User-Agent, max 1 req/s) is respected.
 */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const { lat, lng } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { address: hit.address };

  if (!rateLimit(`geocode:${user.id}`, 20, 60_000).ok || !rateLimit("geocode:global", 1, 1_000).ok) {
    throw new AppError(429, "Too many lookups, please wait a moment", "RATE_LIMITED");
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({ format: "jsonv2", lat: String(lat), lon: String(lng), zoom: "18", addressdetails: "1", "accept-language": "en" }).toString();
  const res = await fetch(url, { headers: { "User-Agent": "CivicPulse/1.0 (civic issue reporting platform)" }, signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!res?.ok) throw new AppError(502, "Address lookup is unavailable right now", "GEOCODER_UNAVAILABLE");
  const data = (await res.json()) as { display_name?: string; address?: Record<string, string> };

  const a = data.address ?? {};
  const parts = [a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road, a.neighbourhood ?? a.suburb ?? a.quarter, a.city_district ?? a.city ?? a.town].filter(Boolean);
  const address = (parts.length ? [...new Set(parts)].join(", ") : (data.display_name ?? "")).slice(0, 250);
  if (cache.size > 2000) cache.clear();
  cache.set(key, { address, at: Date.now() });
  return { address };
});
