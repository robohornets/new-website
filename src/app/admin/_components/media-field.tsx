"use client";

import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/media";

export type MediaOption = { id: number; r2_key: string; filename: string };

type Uploaded = { id: number; r2_key: string; filename: string };

// Some browsers leave File.type empty for HEIC photos from iPhones.
function guessType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    { heic: "image/heic", heif: "image/heif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mov: "video/quicktime", mp4: "video/mp4" }[
      ext ?? ""
    ] ?? "application/octet-stream"
  );
}

export async function uploadFiles(files: File[], extra: Record<string, string> = {}): Promise<Uploaded[]> {
  const out: Uploaded[] = [];
  for (const file of files) {
    const params = new URLSearchParams({ filename: file.name, ...extra });
    // The file is the whole request body, so the Worker can stream it into R2.
    const res = await fetch(`/admin/api/upload?${params}`, {
      method: "POST",
      body: file,
      headers: { "content-type": file.type || guessType(file.name) },
    });
    const json = (await res.json().catch(() => ({}))) as { media?: Uploaded; error?: string };
    if (!res.ok || !json.media) throw new Error(json.error ?? `Upload failed (${res.status})`);
    out.push(json.media);
  }
  return out;
}

/**
 * Picks an image for a form: upload a new file straight to R2, or choose one
 * already in the media library. Submits the media id under `name`.
 */
export function MediaField({
  name,
  label,
  current,
  library,
  hint,
}: {
  name: string;
  label: string;
  current: MediaOption | null;
  library: MediaOption[];
  hint?: string;
}) {
  const [selected, setSelected] = useState<MediaOption | null>(current);
  const [options, setOptions] = useState(library);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = mediaUrl(selected?.r2_key, 320);

  async function onFile(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const [m] = await uploadFiles([files[0]]);
      setSelected(m);
      setOptions((o) => [m, ...o.filter((x) => x.id !== m.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <input type="hidden" name={name} value={selected?.id ?? ""} data-default={current?.id ?? ""} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="hatch flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-label text-[10px] text-ash">NONE</span>
          )}
        </div>
        <div className="flex min-w-0 grow flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label className="flex h-10 cursor-pointer items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
              {busy ? "Uploading…" : "Upload new"}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="sr-only"
                disabled={busy}
                onChange={(e) => onFile(e.target.files)}
              />
            </label>
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-10 items-center rounded-md px-3 text-sm text-dust hover:text-bone"
              >
                Remove
              </button>
            )}
          </div>
          {options.length > 0 && (
            <select
              aria-label={`${label}: choose from media library`}
              value={selected?.id ?? ""}
              onChange={(e) => setSelected(options.find((o) => o.id === Number(e.target.value)) ?? null)}
              className="h-10 max-w-xs rounded-md border border-edge bg-ink px-2 text-sm text-bone"
            >
              <option value="">Or pick from library…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.filename}
                </option>
              ))}
            </select>
          )}
          {hint && <span className="text-xs text-dust">{hint}</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>
      </div>
    </fieldset>
  );
}

/**
 * A small round photo for list rows: click it to upload a new photo, or
 * remove the current one. Submits the media id under `name`.
 */
export function PhotoThumbField({
  name,
  label,
  current,
  initials,
}: {
  name: string;
  label: string;
  current: MediaOption | null;
  initials: string;
}) {
  const [selected, setSelected] = useState<MediaOption | null>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = mediaUrl(selected?.r2_key, 320);

  async function onFile(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const [m] = await uploadFiles([files[0]]);
      setSelected(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative flex shrink-0 flex-col items-center">
      <input type="hidden" name={name} value={selected?.id ?? ""} data-default={current?.id ?? ""} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={selected ? `${label}: change photo` : `${label}: add photo`}
        title={selected ? "Change photo" : "Add photo"}
        className="group relative flex size-12 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-ink hover:border-hornet"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <span className="font-label text-sm font-bold text-dust group-hover:hidden">{initials}</span>
        )}
        <span
          className={`absolute inset-0 items-center justify-center bg-ink/70 text-lg font-bold text-hornet ${busy ? "flex" : "hidden group-hover:flex"}`}
          aria-hidden="true"
        >
          {busy ? "…" : "+"}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFile(e.target.files)}
      />
      {selected && (
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label={`${label}: remove photo`}
          title="Remove photo"
          className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border border-line-strong bg-raise text-xs text-dust hover:text-bone"
        >
          ×
        </button>
      )}
      {error && <span className="absolute top-full mt-1 w-40 text-xs text-danger">{error}</span>}
    </div>
  );
}
