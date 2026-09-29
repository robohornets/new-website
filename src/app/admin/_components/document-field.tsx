"use client";

import { useRef, useState } from "react";
import { originalUrl } from "@/lib/media";
import { inputClass } from "./fields";
import { uploadFiles, type MediaOption } from "./media-field";

/**
 * A document that can either be a PDF uploaded to R2 or a link to somewhere
 * else (Google Drive, Onshape, a website). Submits `${name}_media_id` and
 * `${name}_url`; the public site prefers the uploaded PDF when both are set.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (file.type && file.type !== "application/pdf") {
      setError("That isn't a PDF. Export or print it to PDF first, or paste a link instead.");
      return;
    }
    setBusy(true);
    try {
      const [m] = await uploadFiles([new File([file], file.name, { type: "application/pdf" })]);
      setSelected(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <input type="hidden" name={`${name}_media_id`} value={selected?.id ?? ""} />
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
          <span className="grow text-sm text-ash">No PDF uploaded</span>
        )}
        <label className="flex h-10 cursor-pointer items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
          {busy ? "Uploading…" : selected ? "Replace PDF" : "Upload PDF"}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onFile(e.target.files)}
          />
        </label>
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
      {error && <span className="text-sm text-danger">{error}</span>}
    </fieldset>
  );
}
