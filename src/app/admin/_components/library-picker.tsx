"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Play, Upload } from "@/components/icons";
import { formatBytes, seasonLabel } from "@/lib/format";
import { mediaUrl, originalUrl } from "@/lib/media";
import { inputClass } from "./fields";
import { buttonStyles } from "./items";
import { listAlbums, listSeasons, searchLibrary, type LibraryAlbum, type LibraryItem } from "./library-actions";
import { MediaFilterBar, NO_FILTERS, type FilterValue, type Kind } from "./media-filters";
import { Modal } from "./modal";
import { uploadFiles, type Uploaded, type UploadStatus } from "./upload-client";

export type { Kind, LibraryAlbum, LibraryItem };

const ACCEPT: Record<Kind, string> = {
  image: "image/*,.heic,.heif",
  video: "video/mp4,video/webm,video/quicktime",
  pdf: "application/pdf",
  other: "",
};

function Thumb({ item }: { item: LibraryItem }) {
  if (item.content_type.startsWith("video/")) {
    return (
      <>
        <video src={`${originalUrl(item.r2_key) ?? ""}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex size-9 items-center justify-center rounded-full bg-black/60 text-white">
            <Play size={16} />
          </span>
        </span>
      </>
    );
  }
  if (!item.content_type.startsWith("image/")) {
    return (
      <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
        <span className="rounded bg-raise px-2 py-1 font-label text-xs font-bold text-sand">{item.content_type === "application/pdf" ? "PDF" : (item.filename.split(".").pop() ?? "FILE").toUpperCase()}</span>
        <span className="line-clamp-2 text-[11px] break-all text-dust">{item.filename}</span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl(item.r2_key, 320) ?? ""} alt="" loading="lazy" className="size-full object-cover" />;
}

/** What kind of file the person picked, from its type or (HEIC on some browsers has none) its name. */
function kindOf(file: File): Kind {
  const type = file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/") || ["heic", "heif", "jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (type.startsWith("video/") || ["mov", "mp4", "m4v", "webm"].includes(ext)) return "video";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  return "other";
}

/** A file just uploaded (or found already in the library), as a grid item. */
function asItem(u: Uploaded, file: File, existing?: LibraryItem): LibraryItem {
  if (existing) return existing;
  const of = u.duplicate?.of;
  return {
    id: u.id,
    r2_key: u.r2_key,
    filename: u.filename,
    alt: "",
    content_type: of?.content_type ?? (file.type || "application/octet-stream"),
    size_bytes: file.size,
    width: of?.width ?? null,
    height: of?.height ?? null,
    created_at: new Date().toISOString(),
    albums: "",
    in_target: 0,
  };
}

type Note = { key: string; text: string; file?: File; existing?: LibraryItem };

/**
 * The media library as a grid of thumbnails, with search and filters (type,
 * album, season, used or not, order), and the place to upload new files:
 * anything uploaded here is picked automatically once it's done. A file
 * that's already in the library isn't uploaded again; the existing one is
 * picked instead, with a note and "Upload mine anyway". With `multiple`,
 * tick several and add them all; otherwise pick one (double-click to use it
 * straight away).
 */
export function LibraryPicker({
  open,
  onClose,
  onPick,
  title = "Choose from the library",
  multiple = false,
  kinds = ["image"],
  targetAlbumId,
  pickLabel,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (items: LibraryItem[]) => void;
  title?: string;
  multiple?: boolean;
  /** The kinds of file that fit here (a logo is a photo; an album takes photos and videos; a notebook is a PDF). */
  kinds?: Kind[];
  /** Photos already in this album are shown but can't be picked again. */
  targetAlbumId?: number;
  pickLabel?: (count: number) => string;
}) {
  const [filters, setFilters] = useState<FilterValue>(NO_FILTERS);
  const [query, setQuery] = useState("");
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<Map<number, LibraryItem>>(new Map());
  const [loading, startLoading] = useTransition();
  const [uploading, setUploading] = useState<{ done: number; total: number; status: UploadStatus | null } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const kindKey = kinds.join(",");
  const what = kinds.length === 1 && kinds[0] === "pdf" ? "file" : "photo";
  const label = pickLabel ?? ((n: number) => (multiple ? (n ? `Add ${n} ${n === 1 ? what : `${what}s`}` : `Add ${what}s`) : `Use this ${what}`));

  // The album and season lists, once per opening.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void Promise.all([listAlbums(), listSeasons()]).then(([a, y]) => {
      if (!live) return;
      setAlbums(a);
      setSeasons(y);
    });
    return () => {
      live = false;
    };
  }, [open]);

  // Search as you type (after a short pause), and whenever a filter changes.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const wanted = kindKey.split(",") as Kind[];
    const t = setTimeout(
      () => {
        startLoading(async () => {
          const r = await searchLibrary({
            q: query,
            kinds: filters.kind ? [filters.kind] : wanted,
            albumId: filters.albumId,
            season: filters.season,
            used: filters.used,
            sort: filters.sort,
            targetAlbumId,
          });
          if (!live) return;
          setItems(r.items);
          setMore(r.more);
        });
      },
      query ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, query, filters, kindKey, targetAlbumId]);

  function loadMore() {
    startLoading(async () => {
      const r = await searchLibrary({
        q: query,
        kinds: filters.kind ? [filters.kind] : kinds,
        albumId: filters.albumId,
        season: filters.season,
        used: filters.used,
        sort: filters.sort,
        targetAlbumId,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...r.items.filter((x) => !prev.some((p) => p.id === x.id))]);
      setMore(r.more);
    });
  }

  function close() {
    setSelected(new Map());
    setNotes([]);
    setErrors([]);
    onClose();
  }

  function toggle(item: LibraryItem) {
    setSelected((prev) => {
      if (!multiple) return prev.has(item.id) ? new Map() : new Map([[item.id, item]]);
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  /** Puts an uploaded (or found) file first in the grid and picks it. */
  function arrive(item: LibraryItem, replaces?: number) {
    setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id && p.id !== replaces)]);
    setSelected((prev) => {
      const next = multiple ? new Map(prev) : new Map<number, LibraryItem>();
      if (replaces) next.delete(replaces);
      next.set(item.id, item);
      return next;
    });
  }

  async function upload(files: File[], force = false, replaces?: number) {
    const wanted = files.filter((f) => kinds.includes(kindOf(f)));
    const skipped = files.length - wanted.length;
    setErrors(skipped ? [`${skipped} ${skipped === 1 ? "file isn't" : "files aren't"} the right kind for this and ${skipped === 1 ? "was" : "were"} skipped.`] : []);
    const list = multiple ? wanted : wanted.slice(0, 1);
    if (!list.length) return;
    setUploading({ done: 0, total: list.length, status: null });
    const failed: string[] = [];
    for (const file of list) {
      try {
        const [u] = await uploadFiles([file], {
          allowDuplicate: force,
          onStatus: (status) => setUploading((p) => (p ? { ...p, status } : p)),
          onNote: (text) => setNotes((n) => [...n, { key: `${file.name}-${Date.now()}`, text }]),
        });
        const known = items.find((i) => i.id === u.id);
        const item = asItem(u, file, known);
        arrive(item, replaces);
        if (u.duplicate) {
          setNotes((n) => [
            ...n,
            {
              key: `${file.name}-${u.id}`,
              text: `${file.name} is ${u.duplicate!.of.exact ? "already in the library" : "already in the library as a copy that looks the same"} (${u.duplicate!.of.filename}), so that one is picked instead.`,
              file,
              existing: item,
            },
          ]);
        }
      } catch (e) {
        failed.push(e instanceof Error ? e.message : `${file.name} failed`);
      }
      setUploading((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setErrors((e) => [...e, ...failed]);
    setUploading(null);
  }

  const count = selected.size;
  const busy = Boolean(uploading);
  const accept = kinds.map((k) => ACCEPT[k]).filter(Boolean).join(",");
  const percent = uploading?.status ? Math.round(uploading.status.progress * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={title}
      description={multiple ? "Tick the ones you want, or upload new ones (they're ticked for you)." : "Click one to pick it, or upload a new one."}
      footer={
        <>
          <span className="mr-auto text-sm text-dust">{busy ? "Uploading…" : count ? `${count} picked` : "Nothing picked yet"}</span>
          <button type="button" onClick={close} className={buttonStyles.secondary}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!count || busy}
            onClick={() => {
              onPick([...selected.values()]);
              close();
            }}
            className={buttonStyles.primary}
          >
            {label(count)}
          </button>
        </>
      }
    >
      <div
        className="flex flex-col gap-4"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <div
          className={`flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-dashed px-4 py-3 ${dragging ? "border-hornet bg-hornet/5" : "border-edge"}`}
          aria-busy={busy}
        >
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={buttonStyles.primary}>
            <Upload size={16} /> {multiple ? "Upload new" : "Upload a new one"}
          </button>
          <span className="min-w-0 grow text-sm text-dust" aria-live="polite">
            {uploading
              ? `${uploading.status?.stage === "converting" ? "Converting" : "Uploading"} ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}${uploading.status ? ` · ${uploading.status.file} · ${percent}%` : "…"}`
              : `…or drop ${multiple ? "files" : "a file"} anywhere here. Already in the library? It's picked instead of uploaded twice.`}
          </span>
          <input
            ref={fileRef}
            type="file"
            multiple={multiple}
            accept={accept || undefined}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void upload(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
        {(notes.length > 0 || errors.length > 0) && (
          <ul className="flex flex-col gap-2 text-sm">
            {errors.map((err, i) => (
              <li key={`e${i}`} role="alert" className="text-danger">
                {err}
              </li>
            ))}
            {notes.map((n) => (
              <li key={n.key} role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-raise/60 px-3 py-2 text-sand">
                {n.existing && (
                  <span className="relative block size-10 shrink-0 overflow-hidden rounded bg-ink">
                    <Thumb item={n.existing} />
                  </span>
                )}
                <span className="min-w-0 grow">{n.text}</span>
                {n.file && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setNotes((all) => all.filter((x) => x.key !== n.key));
                      void upload([n.file!], true, n.existing?.id);
                    }}
                    className="text-sm font-semibold text-hornet hover:text-hornet-hover"
                  >
                    Upload mine anyway
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <MediaFilterBar
          value={{ ...filters, q: query }}
          kinds={kinds}
          albums={albums}
          seasons={seasons}
          onChange={(patch) => {
            if ("q" in patch && patch.q !== undefined) setQuery(patch.q);
            const { q, ...rest } = patch;
            void q;
            if (Object.keys(rest).length) setFilters((f) => ({ ...f, ...rest }));
          }}
        />

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-8 text-center text-sm text-dust">
            {loading ? "Loading…" : query || filters !== NO_FILTERS ? "Nothing matches." : "Nothing here yet. Upload something above."}
          </p>
        ) : (
          <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ${loading ? "opacity-70" : ""}`}>
            {items.map((it) => {
              const ticked = selected.has(it.id);
              const already = it.in_target === 1;
              const name = it.alt || it.filename;
              return (
                <li key={it.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => toggle(it)}
                    onDoubleClick={() => {
                      if (multiple || already) return;
                      onPick([it]);
                      close();
                    }}
                    aria-pressed={ticked}
                    title={[it.filename, `${formatBytes(it.size_bytes)}${it.width && it.height ? ` · ${it.width}×${it.height}` : ""}`, it.albums].filter(Boolean).join("\n")}
                    className={`group flex w-full flex-col gap-1.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hornet ${already ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <span className={`relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-ink ${ticked ? "border-hornet" : "border-transparent group-hover:border-edge"}`}>
                      <Thumb item={it} />
                      {!already && (
                        <span
                          aria-hidden="true"
                          className={`absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                            ticked ? "border-hornet bg-hornet text-ink" : "border-white/80 bg-black/40 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      )}
                      {already && <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center font-label text-[11px] text-white">Already in it</span>}
                    </span>
                    <span className="truncate text-xs text-sand">{name}</span>
                    {it.albums && <span className="-mt-1 truncate font-label text-[11px] text-ash">{it.albums}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {more && (
          <button type="button" onClick={loadMore} disabled={loading} className={`${buttonStyles.secondary} self-center`}>
            {loading ? "Loading…" : "Show more"}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Every album as a card with its cover, searchable; click one to use it. */
export function AlbumPicker({
  open,
  onClose,
  onPick,
  currentId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (album: LibraryAlbum) => void;
  currentId?: number | null;
}) {
  const [albums, setAlbums] = useState<LibraryAlbum[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let live = true;
    void listAlbums().then((a) => live && setAlbums(a));
    return () => {
      live = false;
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = (albums ?? []).filter((a) => !q || a.title.toLowerCase().includes(q) || seasonLabel(a.season_year).includes(q));

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Choose an album" description="Its photos become this one's. Nothing is copied: change the album and this changes too.">
      <div className="flex flex-col gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search albums"
          aria-label="Search albums"
          className={inputClass}
          autoFocus
        />
        {albums === null ? (
          <p className="text-sm text-dust">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-8 text-center text-sm text-dust">No albums match.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(a);
                    onClose();
                  }}
                  aria-current={a.id === currentId ? "true" : undefined}
                  className={`group flex w-full flex-col overflow-hidden rounded-md border-2 bg-ink text-left ${a.id === currentId ? "border-hornet" : "border-line hover:border-edge"}`}
                >
                  <span className="hatch block aspect-[4/3] w-full overflow-hidden">
                    {a.cover_key && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(a.cover_key, 320) ?? ""} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                  </span>
                  <span className="flex flex-col gap-0.5 p-2.5">
                    <span className="truncate text-sm font-semibold group-hover:text-hornet">{a.title}</span>
                    <span className="font-label text-[11px] text-dust">
                      {a.season_year ? `${seasonLabel(a.season_year)} · ` : ""}
                      {a.photos} {a.photos === 1 ? "photo" : "photos"}
                      {a.id === currentId ? " · in use" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/**
 * "Photos come from" on a robot's or an impact event's page: the album in
 * use, with buttons to pick another (from cards with covers) or none.
 * Submits the album id under `name` through the save bar.
 */
export function AlbumField({
  name,
  current,
  noneLabel,
  hint,
}: {
  name: string;
  current: LibraryAlbum | null;
  /** What having no album means here, e.g. "Its own album, made when you upload above". */
  noneLabel: string;
  hint?: string;
}) {
  const [album, setAlbum] = useState<LibraryAlbum | null>(current);
  const [open, setOpen] = useState(false);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold">Photos come from</legend>
      <input type="hidden" name={name} value={album?.id ?? ""} data-default={current?.id ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 items-center gap-3 rounded-md border border-line bg-ink p-2 pr-4">
          <span className="hatch block h-12 w-16 shrink-0 overflow-hidden rounded">
            {album?.cover_key && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(album.cover_key, 320) ?? ""} alt="" className="size-full object-cover" />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{album ? album.title : noneLabel}</span>
            {album && (
              <span className="font-label text-[11px] text-dust">
                {album.season_year ? `${seasonLabel(album.season_year)} · ` : ""}
                {album.photos} {album.photos === 1 ? "photo" : "photos"}
              </span>
            )}
          </span>
        </span>
        <button type="button" onClick={() => setOpen(true)} className={buttonStyles.secondary} aria-haspopup="dialog">
          {album ? "Use another album" : "Use an existing album"}
        </button>
        {album && (
          <button type="button" onClick={() => setAlbum(null)} className="h-10 px-2 text-sm text-dust hover:text-bone">
            No album
          </button>
        )}
      </div>
      {hint && <span className="text-xs text-dust">{hint}</span>}
      <AlbumPicker open={open} onClose={() => setOpen(false)} onPick={setAlbum} currentId={album?.id} />
    </fieldset>
  );
}
