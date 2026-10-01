"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { LibraryPicker } from "./library-picker";

export type MediaOption = { id: number; r2_key: string; filename: string };

// Uploading lives in upload-client.ts; re-exported for the fields that use it.
import { uploadFiles } from "./upload-client";
export { uploadFiles };

/**
 * Picks an image for a form (a season photo, a logo). Opens the library:
 * pick one already there or upload a new one, which is picked once it's in.
 * Submits the media id under `name`.
 */
export function MediaField({
  name,
  label,
  current,
  hint,
}: {
  name: string;
  label: string;
  current: MediaOption | null;
  hint?: string;
}) {
  const [selected, setSelected] = useState<MediaOption | null>(current);
  const [picking, setPicking] = useState(false);
  const preview = mediaUrl(selected?.r2_key, 320);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <input type="hidden" name={name} value={selected?.id ?? ""} data-default={current?.id ?? ""} />
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={selected ? `${label}: ${selected.filename}. Change it` : `${label}: choose one`}
          className="hatch flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line hover:border-edge"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-label text-[10px] text-ash">NONE</span>
          )}
        </button>
        <div className="flex min-w-0 grow flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-haspopup="dialog"
              className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
            >
              {selected ? "Change" : "Choose or upload"}
            </button>
            {selected && (
              <button type="button" onClick={() => setSelected(null)} className="flex h-10 items-center rounded-md px-3 text-sm text-dust hover:text-bone">
                Remove
              </button>
            )}
          </div>
          {hint && <span className="text-xs text-dust">{hint}</span>}
        </div>
      </div>
      <LibraryPicker
        open={picking}
        onClose={() => setPicking(false)}
        title={label}
        kinds={["image"]}
        onPick={([m]) => m && setSelected({ id: m.id, r2_key: m.r2_key, filename: m.filename })}
      />
    </fieldset>
  );
}
