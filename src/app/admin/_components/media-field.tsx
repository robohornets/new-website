"use client";

import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/media";

export type MediaOption = { id: number; r2_key: string; filename: string };


// Uploading lives in upload-client.ts; re-exported for the fields that use it.
import { uploadFiles } from "./upload-client";
export { uploadFiles };

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
