"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Crosshair, Loader2, MapPin, Send } from "lucide-react";
import type { IssueCategory, IssueStatus } from "@/db/schema";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/constants";
import { api, ApiError } from "@/lib/api-client";
import { createIssueSchema } from "@/lib/validation";
import { inBounds, type CityBounds } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { Button, Card, CardHeader, Field, inputClass, StatusBadge } from "@/components/ui";
import { ImageUploader, type Uploaded } from "@/components/image-uploader";
import { IssueMap } from "@/components/map";
import { useToast } from "@/components/toast";
import { useDebounce } from "@/components/use-debounce";

type Area = { id: string; name: string; zone: string; latitude: number; longitude: number };
type Dupe = { id: string; referenceCode: string; title: string; status: IssueStatus; distance: number; score: number; key?: string };

export function ReportForm({ areas, center, bounds, city }: { areas: Area[]; center: [number, number]; bounds: CityBounds; city: string }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [address, setAddress] = useState("");
  const [areaId, setAreaId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Uploaded[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [dupes, setDupes] = useState<Dupe[]>([]);

  const latN = Number(lat);
  const lngN = Number(lng);
  const hasPoint = lat !== "" && lng !== "" && Number.isFinite(latN) && Number.isFinite(lngN);
  const outside = hasPoint && !inBounds(latN, lngN, bounds);
  const pin = useMemo<[number, number] | null>(() => (hasPoint ? [latN, lngN] : null), [hasPoint, latN, lngN]);

  // Live duplicate detection as the citizen fills in the form.
  const dupKey = useDebounce(`${lat}|${lng}|${category}|${title}`, 600);
  useEffect(() => {
    const [la, ln, cat, t] = dupKey.split("|");
    if (!la || !ln || !cat) return;
    const p = new URLSearchParams({ lat: la, lng: ln, category: cat, title: t });
    api<{ items: Dupe[] }>(`/api/issues/duplicates?${p}`)
      .then((d) => setDupes(d.items.map((x) => ({ ...x, key: dupKey }))))
      .catch(() => setDupes([]));
  }, [dupKey]);

  const visibleDupes = hasPoint && category ? dupes : [];
  const setPoint = (la: number, ln: number) => {
    setLat(la.toFixed(6));
    setLng(ln.toFixed(6));
    // Snap to the closest known area for convenience.
    let best: Area | null = null;
    let bestD = Infinity;
    for (const a of areas) {
      const d = Math.hypot(a.latitude - la, a.longitude - ln);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best && bestD < 0.03) setAreaId(best.id);
  };

  const useGps = () => {
    if (!navigator.geolocation) return toast({ kind: "error", title: "GPS is not available in this browser" });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setAccuracy(Math.round(pos.coords.accuracy));
        setPoint(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        toast({ kind: "error", title: "Could not read your GPS location", message: err.code === 1 ? "Location permission was denied. Pick the spot on the map instead." : err.message });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { title, description, category: category || undefined, address, latitude: lat, longitude: lng, areaId: areaId || null, imageIds: photos.map((p) => p.id) };
    const parsed = createIssueSchema.safeParse(payload);
    const errs: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
    if (!hasPoint) errs.latitude = "Pick the location on the map or use GPS";
    else if (outside) errs.latitude = `The location must be inside ${city}`;
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast({ kind: "error", title: "Please fix the highlighted fields" });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await api<{ issue: { id: string; referenceCode: string } }>("/api/issues", { method: "POST", json: parsed.data });
      toast({ kind: "success", title: `Report ${res.issue.referenceCode} submitted`, message: "You'll be notified as it progresses." });
      router.push(`/issues/${res.issue.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast({ kind: "error", title: err.message });
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="1. What's the problem?" />
          <div className="space-y-4 p-5">
            <Field label="Category" error={errors.category} required>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition", category === c ? "border-accent-500 bg-accent-50 ring-2 ring-accent-500/30 dark:bg-accent-900/30" : "border-line hover:bg-surface-2")}
                  >
                    <span className="size-3 rounded-full" style={{ background: CATEGORY_COLORS[c] }} /> {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Title" htmlFor="title" error={errors.title} required hint={`${title.length}/140`}>
              <input id="title" maxLength={140} className={inputClass} placeholder="e.g. Large pothole in front of Gulshan 2 market" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
            </Field>
            <Field label="Description" htmlFor="description" error={errors.description} required hint="What is wrong, how long it has been like this, and any danger to people.">
              <textarea id="description" rows={5} maxLength={4000} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="2. Where is it?" description="Use GPS, click the map, or drag the pin to the exact spot." />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="accent" onClick={useGps} loading={locating}>
                {!locating && <Crosshair className="size-4" />} Use my GPS location
              </Button>
              {accuracy != null && <span className="self-center text-xs text-muted">GPS accuracy ±{accuracy} m</span>}
            </div>
            <IssueMap points={[]} center={pin ?? center} zoom={pin ? 16 : 12} height={340} pin={pin} onMapClick={setPoint} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" htmlFor="lat" error={errors.latitude} required>
                <input id="lat" inputMode="decimal" className={inputClass} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="23.7808" aria-invalid={!!errors.latitude || outside} />
              </Field>
              <Field label="Longitude" htmlFor="lng" error={errors.longitude} required>
                <input id="lng" inputMode="decimal" className={inputClass} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="90.4093" aria-invalid={!!errors.longitude || outside} />
              </Field>
            </div>
            {outside && <p className="text-xs font-medium text-rose-600">This point is outside the {city} service area.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address / landmark" htmlFor="address" error={errors.address} required>
                <input id="address" className={inputClass} placeholder="House 12, Road 5, near the mosque" value={address} onChange={(e) => setAddress(e.target.value)} aria-invalid={!!errors.address} />
              </Field>
              <Field label="Area" htmlFor="area" hint="Filled automatically from the pin">
                <select id="area" className={inputClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  <option value="">Detect automatically</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} · {a.zone}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="3. Add photos" description="At least one clear photo helps the team verify the problem faster." />
          <div className="p-5">
            <ImageUploader value={photos} onChange={setPhotos} invalid={!!errors.imageIds} />
            {errors.imageIds && <p className="mt-1 text-xs font-medium text-rose-600">{errors.imageIds}</p>}
          </div>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        {visibleDupes.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-4" /> Similar reports nearby
              </p>
              <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">This might already be reported. Check before submitting a duplicate.</p>
              <ul className="mt-3 space-y-2">
                {visibleDupes.map((d) => (
                  <li key={d.id}>
                    <Link href={`/issues/${d.id}`} target="_blank" className="block rounded-lg bg-surface p-2.5 text-sm hover:ring-2 hover:ring-amber-300">
                      <p className="font-medium">{d.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <StatusBadge status={d.status} /> <MapPin className="size-3" /> {d.distance} m away
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
        <Card className="p-5">
          <h2 className="font-semibold">Review & submit</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted">Category</dt><dd>{category ? CATEGORY_LABELS[category] : "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Location</dt><dd className="font-mono text-xs">{hasPoint ? `${latN.toFixed(5)}, ${lngN.toFixed(5)}` : "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Photos</dt><dd>{photos.length}</dd></div>
          </dl>
          <Button type="submit" variant="primary" className="mt-5 w-full" loading={submitting}>
            {!submitting && <Send className="size-4" />} Submit report
          </Button>
          <p className="mt-3 text-xs text-muted">Your report will be routed to the responsible department. You can edit it until review starts.</p>
          {submitting && <Loader2 className="hidden" />}
        </Card>
      </div>
    </form>
  );
}
