"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Upload } from "@/components/icons";
import { mediaUrl } from "@/lib/media";
import { addPhotosToAlbum, removeAlbumPhoto } from "../gallery/actions";
import { LibraryPicker } from "./library-picker";
import { uploadFiles, type Uploaded, type UploadStatus } from "./upload-client";

type Dupe = NonNullable<Uploaded["duplicate"]>;

/**
 * Where photos and videos are added. Clicking opens the library (pick ones
 * already uploaded, or upload new ones there: they're picked for you).
 * Dropping files on it uploads them straight in, for big batches after an
 * event. Either way, a file that's already in the library isn't stored
 * twice: the existing one is used, with "Upload mine anyway" if it's really a
 * different photo. Videos are converted to MP4 first (see upload-client.ts);
 * `direct` says whether files go straight to R2, which allows bigger videos.
 * Without an album (the Media library page), clicking just picks files.
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
  const [dupes, setDupes] = useState<Dupe[]>([]);
  const [dragging, setDragging] = useState(false);
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  // Adding from the library: "Adding…" until the photos below have refreshed.
  const [adding, startAdding] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const hasAlbum = Boolean(albumId || ensureAlbum);

  /** The album to put photos in, made first if this is a robot's or event's first photos. */
  async function targetAlbum(): Promise<number | undefined> {
    if (albumId || !ensureAlbum) return albumId;
    return ensureAlbum();
  }

  function addFromLibrary(ids: number[]) {
    setErrors([]);
    setAdded(null);
    startAdding(async () => {
      try {
        const album = await targetAlbum();
        if (!album) return;
        const result = await addPhotosToAlbum(album, ids);
        if (result.ok) setAdded(result.message ?? "Added.");
        else setErrors([result.error ?? "Couldn't add those photos."]);
        router.refresh();
      } catch (e) {
        setErrors([e instanceof Error ? e.message : "Couldn't add those photos."]);
      }
    });
  }

  async function handle(files: File[], force = false) {
    if (!files.length) return;
    setAdded(null);
    setErrors([]);
    setNotes([]);
    if (!force) setDupes([]);
    setProgress({ done: 0, total: files.length });
    const failed: string[] = [];
    let album: number | undefined;
    try {
      album = await targetAlbum();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Couldn't make the album for these photos."]);
      setProgress(null);
      return;
    }
    for (const file of files) {
      try {
        const [u] = await uploadFiles([file], {
          extra: album ? { album_id: String(album) } : {},
          allowDuplicate: force,
          onStatus: setCurrent,
          onNote: (note) => setNotes((n) => [...n, note]),
        });
        if (u.duplicate) setDupes((d) => [...d, u.duplicate!]);
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

  /** "Upload mine anyway": stores this copy too, in place of the one it was matched to (if that was put in the album just for it). */
  async function uploadAnyway(d: Dupe) {
    setDupes((all) => all.filter((x) => x !== d));
    if (d.addedToAlbum && albumId) await removeAlbumPhoto(albumId, d.of.id, { ok: true });
    await handle([d.file], true);
  }

  const busy = Boolean(progress);
  const percent = current ? Math.round(current.progress * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && (hasAlbum ? setPicking(true) : fileRef.current?.click())}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            if (hasAlbum) setPicking(true);
            else fileRef.current?.click();
          }
        }}
        aria-haspopup={hasAlbum ? "dialog" : undefined}
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
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed px-6 py-10 text-center focus-visible:border-hornet focus-visible:outline-none ${
          busy ? "cursor-progress border-edge" : "cursor-pointer"
        } ${dragging ? "border-hornet bg-hornet/5" : busy ? "" : "border-edge hover:border-bone"}`}
      >
        <Upload className="text-hornet" size={28} />
        <span className="font-semibold" aria-live="polite">
          {progress ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : adding ? "Adding…" : label}
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
          <span className="max-w-2xl text-xs text-dust">
            {hasAlbum
              ? "Click to pick from the library or upload new ones, or drop files here to upload them straight in. "
              : "Drop files here or click to choose. "}
            Photos (JPG, PNG, HEIC, WebP…) up to 20 MB, videos (MP4, MOV, WebM) up to {direct ? "1 GB" : "95 MB"}, converted to MP4 so every browser can play them.
            Anything already in the library is used instead of being uploaded twice.
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.heic,.heif,video/mp4,video/webm,video/quicktime,application/pdf"
          className="sr-only"
          tabIndex={-1}
          disabled={busy}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            void handle(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {added && !adding && (
        <p role="status" className="text-sm text-sand">
          {added}
        </p>
      )}
      {hasAlbum && (
        <LibraryPicker
          open={picking}
          onClose={() => setPicking(false)}
          multiple
          kinds={["image", "video"]}
          targetAlbumId={albumId}
          title="Add photos"
          onPick={(items) => addFromLibrary(items.map((i) => i.id))}
        />
      )}
      {dupes.length > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-md bg-raise/60 p-3 text-sm text-sand">
          <p>
            {dupes.length === 1 ? "1 file was" : `${dupes.length} files were`} already in the library, so {dupes.length === 1 ? "that copy is" : "those copies are"} used
            instead of storing {dupes.length === 1 ? "it" : "them"} again:
          </p>
          <ul className="flex flex-col gap-2">
            {dupes.map((d, i) => (
              <li key={`${d.of.id}-${i}`} className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <DupeThumb file={d.file} />
                  <span className="text-dust">=</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(d.of.r2_key, 320) ?? ""} alt="" className="size-10 rounded bg-ink object-cover" />
                </span>
                <span className="min-w-0 grow">
                  <strong className="text-bone">{d.file.name}</strong> {d.of.exact ? "is the same file as" : "looks the same as"} {d.of.filename}
                </span>
                <button type="button" disabled={busy} onClick={() => void uploadAnyway(d)} className="font-semibold text-hornet hover:text-hornet-hover">
                  Upload mine anyway
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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

/** A small preview of a file that wasn't uploaded, straight from the person's device. */
function DupeThumb({ file }: { file: File }) {
  // Not revoked: there are only a few, and they go when the page does.
  const [src] = useState(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : ""));
  if (!src) return <span className="flex size-10 items-center justify-center rounded bg-ink font-label text-[10px] text-dust">FILE</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="size-10 rounded bg-ink object-cover" />;
}
