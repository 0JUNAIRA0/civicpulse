"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing, Save } from "lucide-react";
import type { Settings } from "@/lib/validation";
import { settingsSchema } from "@/lib/validation";
import { api, ApiError } from "@/lib/api-client";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import { Button, Card, CardHeader, Field, inputClass } from "../ui";
import { useToast } from "../toast";

export function SettingsForm({ initial }: { initial: Settings }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reminding, setReminding] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const num = (s: string) => (s === "" ? ("" as unknown as number) : Number(s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = settingsSchema.safeParse(v);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[i.path.join(".")] ??= i.message;
      setErrors(out);
      return toast({ kind: "error", title: "Please fix the highlighted fields" });
    }
    setBusy(true);
    setErrors({});
    try {
      await api("/api/settings", { method: "PUT", json: parsed.data });
      toast({ kind: "success", title: "Settings saved" });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast({ kind: "error", title: err.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <Card>
        <CardHeader title="City & map" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="City name" error={errors.cityName}><input className={inputClass} value={v.cityName} onChange={(e) => setV({ ...v, cityName: e.target.value })} /></Field>
          <Field label="Map centre latitude" error={errors["mapCenter.lat"]}><input className={inputClass} value={v.mapCenter.lat} onChange={(e) => setV({ ...v, mapCenter: { ...v.mapCenter, lat: num(e.target.value) } })} /></Field>
          <Field label="Map centre longitude" error={errors["mapCenter.lng"]}><input className={inputClass} value={v.mapCenter.lng} onChange={(e) => setV({ ...v, mapCenter: { ...v.mapCenter, lng: num(e.target.value) } })} /></Field>
          <Field label="Default zoom" error={errors["mapCenter.zoom"]}><input type="number" min={3} max={18} className={inputClass} value={v.mapCenter.zoom} onChange={(e) => setV({ ...v, mapCenter: { ...v.mapCenter, zoom: num(e.target.value) } })} /></Field>
        </div>
        <div className="border-t border-line px-5 py-4">
          <p className="mb-3 text-sm font-medium">Service area (GPS validation bounds)</p>
          <div className="grid gap-4 sm:grid-cols-4">
            {(["north", "south", "east", "west"] as const).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)} error={errors[`cityBounds.${k}`] ?? (k === "north" ? errors.cityBounds : undefined)}>
                <input className={inputClass} value={v.cityBounds[k]} onChange={(e) => setV({ ...v, cityBounds: { ...v.cityBounds, [k]: num(e.target.value) } })} />
              </Field>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Reports with GPS coordinates outside this box are rejected by the server.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Workflow" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Duplicate detection radius (metres)" error={errors.duplicateRadiusMeters} hint="Same-category open reports within this distance are flagged.">
            <input type="number" className={inputClass} value={v.duplicateRadiusMeters} onChange={(e) => setV({ ...v, duplicateRadiusMeters: num(e.target.value) })} />
          </Field>
          <Field label="Reminder interval (hours)" error={errors.reminderIntervalHours} hint="How often staff are reminded about due and overdue tasks.">
            <input type="number" className={inputClass} value={v.reminderIntervalHours} onChange={(e) => setV({ ...v, reminderIntervalHours: num(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#00A6A6]" checked={v.autoRouteToDepartment} onChange={(e) => setV({ ...v, autoRouteToDepartment: e.target.checked })} /> Route new reports to departments automatically by category</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#00A6A6]" checked={v.allowCitizenRegistration} onChange={(e) => setV({ ...v, allowCitizenRegistration: e.target.checked })} /> Allow citizen self-registration</label>
        </div>
        <div className="border-t border-line px-5 py-4">
          <p className="mb-3 text-sm font-medium">Resolution targets (days) by priority</p>
          <div className="grid gap-4 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <Field key={p} label={PRIORITY_LABELS[p]} error={errors[`slaDays.${p}`]}>
                <input type="number" className={inputClass} value={v.slaDays[p]} onChange={(e) => setV({ ...v, slaDays: { ...v.slaDays, [p]: num(e.target.value) } })} />
              </Field>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Contact" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Support email" error={errors.supportEmail}><input type="email" className={inputClass} value={v.supportEmail} onChange={(e) => setV({ ...v, supportEmail: e.target.value })} /></Field>
        </div>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          loading={reminding}
          onClick={async () => {
            setReminding(true);
            try {
              const r = await api<{ reminded: number }>("/api/cron/reminders", { method: "POST" });
              toast({ kind: "success", title: `Sent ${r.reminded} maintenance reminder${r.reminded === 1 ? "" : "s"}` });
            } catch (e) {
              toast({ kind: "error", title: e instanceof ApiError ? e.message : "Failed" });
            } finally {
              setReminding(false);
            }
          }}
        >
          <BellRing className="size-4" /> Run maintenance reminders now
        </Button>
        <Button type="submit" loading={busy}>
          <Save className="size-4" /> Save settings
        </Button>
      </div>
    </form>
  );
}
