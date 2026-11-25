const R = 6371000;

/** Great-circle distance in metres. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Bounding box around a point, used to pre-filter rows with an index before the exact distance check. */
export function boundingBox(lat: number, lng: number, radiusM: number) {
  const dLat = (radiusM / R) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export type CityBounds = { north: number; south: number; east: number; west: number };

export function inBounds(lat: number, lng: number, b: CityBounds) {
  return lat <= b.north && lat >= b.south && lng <= b.east && lng >= b.west;
}

/** Simple word-overlap similarity (Jaccard) for duplicate detection. */
export function textSimilarity(a: string, b: string) {
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    );
  const A = tok(a);
  const B = tok(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

const STOP = new Set(["the", "and", "near", "for", "with", "from", "this", "that", "road", "street", "area", "there", "are", "has", "have", "not"]);
