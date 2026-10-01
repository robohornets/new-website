"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "@/components/icons";
import { uploadFiles, type UploadStatus } from "./upload-client";

/**
 * Drag-and-drop or pick many files; uploads them one by one. Videos are
 * converted to MP4 first (see upload-client.ts). `direct` says whether files
 * go straight to R2, which allows bigger videos.
 */
export function BulkUploader({
  albumId,
  ensureAlbum,
  label = "Upload photos",
  direct = false,
}: {
  albumId?: number;
  /** Called before the first upload when there's no album yet (a robot's photos); returns the album to upload into. */
  ensureAlbum?: () => Promise<number>;
  label?: string;
  direct?: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [current, setCurrent] = useState<UploadStatus | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  async function handle(files: File[]) {
    if (!files.length) return;
    setErrors([]);
    setNotes([]);
    setProgress({ done: 0, total: files.length });
    const failed: string[] = [];
    let album = albumId;
    if (!album && ensureAlbum) {
      try {
        album = await ensureAlbum();
      } catch (e) {
        setErrors([e instanceof Error ? e.message : "Couldn't make the album for these photos."]);
        setProgress(null);
        return;
      }
    }
    for (const file of files) {
      try {
        await uploadFiles([file], {
          extra: album ? { album_id: String(album) } : {},
          onStatus: setCurrent,
          onNote: (note) => setNotes((n) => [...n, note]),
        });
      } catch (e) {
        failed.push(e instanceof Error ? e.message : `${file.name} failed`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setErrors(failed);
    setProgress(null);
    setCurrent(null);
    router.refresh();
  }

  const busy = Boolean(progress);
  const percent = current ? Math.round(current.progress * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void handle(Array.from(e.dataTransfer.files));
        }}
        aria-busy={busy}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed px-6 py-10 text-center ${
          busy ? "cursor-progress border-edge" : "cursor-pointer"
        } ${dragging ? "border-hornet bg-hornet/5" : busy ? "" : "border-edge hover:border-bone"}`}
      >
        <Upload className="text-hornet" size={28} />
        <span className="font-semibold" aria-live="polite">
          {progress ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : label}
        </span>
        {current ? (
          <span className="flex w-full max-w-sm flex-col items-center gap-1.5">
            <span className="w-full truncate text-xs text-sand">
              {current.stage === "converting" ? "Converting video for every browser" : "Sending"} · {current.file} · {percent}%
            </span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-raise" aria-hidden="true">
              <span className="block h-full rounded-full bg-hornet transition-[width]" style={{ width: `${percent}%` }} />
            </span>
            {current.stage === "converting" && <span className="text-xs text-dust">Keep this tab open. Converting can take a minute for long videos.</span>}
          </span>
        ) : (
          <span className="text-xs text-dust">
            Drop files here or click to choose. Photos (JPG, PNG, HEIC, WebP…) up to 20 MB, videos (MP4, MOV, WebM) up to {direct ? "1 GB" : "95 MB"}.
            Videos are converted to MP4 so every browser can play them; photos are kept exactly as uploaded.
          </span>
        )}
        <input
          type="file"
          multiple
          accept="image/*,.heic,.heif,video/mp4,video/webm,video/quicktime,application/pdf"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void handle(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {notes.length > 0 && (
        <ul role="status" className="flex flex-col gap-1 text-sm text-sand">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-danger">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
