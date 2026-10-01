"use client";

import { useState } from "react";
import { originalUrl } from "@/lib/media";
import { inputClass } from "./fields";
import { LibraryPicker } from "./library-picker";
import type { MediaOption } from "./media-field";

/**
 * A document that can either be a PDF in the media library or a link to
 * somewhere else (Google Drive, Onshape, a website). Choosing opens the
 * library, filtered to PDFs, where a new one can be uploaded too. Submits
 * `${name}_media_id` and `${name}_url`; the public site prefers the PDF when
 * both are set.
 */
export function DocumentField({
  name,
  label,
  current,
  currentUrl,
  hint,
}: {
  name: string;
  label: string;
  current: MediaOption | null;
  currentUrl: string | null;
  hint?: string;
}) {
  const [selected, setSelected] = useState<MediaOption | null>(current);
  const [picking, setPicking] = useState(false);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <input type="hidden" name={`${name}_media_id`} value={selected?.id ?? ""} data-default={current?.id ?? ""} />
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-ink px-4 py-3">
        <span className="rounded bg-rust px-1.5 py-0.5 font-label text-[10px] font-bold tracking-wide text-white">PDF</span>
        {selected ? (
          <a
            href={originalUrl(selected.r2_key) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 grow truncate text-sm font-semibold text-hornet hover:text-hornet-hover"
          >
            {selected.filename}
          </a>
        ) : (
          <span className="grow text-sm text-ash">No PDF</span>
        )}
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
        >
          {selected ? "Change PDF" : "Choose or upload a PDF"}
        </button>
        {selected && (
          <button type="button" onClick={() => setSelected(null)} className="flex h-10 items-center px-2 text-sm text-dust hover:text-bone">
            Remove
          </button>
        )}
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Or a link instead
        <input
          type="url"
          name={`${name}_url`}
          defaultValue={currentUrl ?? ""}
          placeholder="https://drive.google.com/…"
          className={inputClass}
        />
      </label>
      {hint && <span className="text-xs text-dust">{hint}</span>}
      <LibraryPicker
        open={picking}
        onClose={() => setPicking(false)}
        title={label}
        kinds={["pdf"]}
        onPick={([m]) => m && setSelected({ id: m.id, r2_key: m.r2_key, filename: m.filename })}
      />
    </fieldset>
  );
}
