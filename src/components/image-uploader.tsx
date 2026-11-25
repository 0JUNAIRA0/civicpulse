"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { ApiError, uploadImage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type Uploaded = { id: string; url: string; preview: string; name: string };

/** Pick, preview, validate and upload images. Calls onChange with the uploaded ids. */
export function ImageUploader({ value, onChange, max = 5, label = "Add photos", invalid }: { value: Uploaded[]; onChange: (v: Uploaded[]) => void; max?: number; label?: string; invalid?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    const list = Array.from(files).slice(0, max - value.length);
    const next = [...value];
    for (const f of list) {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)) {
        setError(`${f.name}: only JPEG, PNG or WebP images are allowed`);
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES * 3) {
        setError(`${f.name} is too large (max 5 MB after compression)`);
        continue;
      }
      setBusy((b) => b + 1);
      try {
        const up = await uploadImage(f);
        next.push({ id: up.id, url: up.url, preview: URL.createObjectURL(f), name: f.name });
        onChange([...next]);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Upload failed");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {value.map((img) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.preview} alt={img.name} className="size-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((v) => v.id !== img.id))} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white" aria-label={`Remove ${img.name}`}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFiles(e.dataTransfer.files);
            }}
            className={cn("flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted hover:border-accent-400 hover:text-accent-600", invalid ? "border-rose-400" : "border-line")}
          >
            {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            {busy ? "Uploading…" : label}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <p className="mt-1.5 text-xs text-muted">JPEG, PNG or WebP. Up to {max} photos, 5 MB each. Large photos are resized automatically.</p>
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
