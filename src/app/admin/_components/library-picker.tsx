"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Play } from "@/components/icons";
import { seasonLabel } from "@/lib/format";
import { mediaUrl, originalUrl } from "@/lib/media";
import { inputClass } from "./fields";
import { buttonStyles } from "./items";
import { listAlbums, searchLibrary, type LibraryAlbum, type LibraryItem } from "./library-actions";
import { Modal } from "./modal";

export type { LibraryAlbum, LibraryItem };

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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl(item.r2_key, 320) ?? ""} alt="" loading="lazy" className="size-full object-cover" />;
}

/**
 * The media library as a grid of thumbnails, searchable by file name, alt
 * text, description or album, and filterable by album. Pick one photo (it's
 * used straight away) or, with `multiple`, tick several and add them.
 */
export function LibraryPicker({
  open,
  onClose,
  onPick,
  title = "Choose from the library",
  multiple = false,
  videos = false,
  targetAlbumId,
  pickLabel = (n) => (n ? `Add ${n} ${n === 1 ? "photo" : "photos"}` : "Add photos"),
}: {
  open: boolean;
  onClose: () => void;
  onPick: (items: LibraryItem[]) => void;
  title?: string;
  multiple?: boolean;
  /** Videos too (albums can hold them; covers and logos can't). */
  videos?: boolean;
  /** Photos already in this album are shown but can't be picked again. */
  targetAlbumId?: number;
  pickLabel?: (count: number) => string;
}) {
  const [query, setQuery] = useState("");
  const [albumId, setAlbumId] = useState(0);
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<Map<number, LibraryItem>>(new Map());
  const [loading, startLoading] = useTransition();
  const searchId = useId();

  // The album list, once per opening.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void listAlbums().then((a) => live && setAlbums(a));
    return () => {
      live = false;
    };
  }, [open]);

  // Search as you type (after a short pause), and whenever the album filter changes.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(() => {
      startLoading(async () => {
        const r = await searchLibrary({ q: query, albumId, videos, targetAlbumId });
        if (!live) return;
        setItems(r.items);
        setMore(r.more);
      });
    }, query ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, query, albumId, videos, targetAlbumId]);

  function loadMore() {
    startLoading(async () => {
      const r = await searchLibrary({ q: query, albumId, videos, targetAlbumId, offset: items.length });
      setItems((prev) => [...prev, ...r.items.filter((x) => !prev.some((p) => p.id === x.id))]);
      setMore(r.more);
    });
  }

  function close() {
    setSelected(new Map());
    onClose();
  }

  function choose(item: LibraryItem) {
    if (!multiple) {
      onPick([item]);
      close();
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  const count = selected.size;

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={title}
      description={multiple ? "Click photos to tick them, then add them all at once." : "Click a photo to use it."}
      footer={
        multiple ? (
          <>
            <span className="mr-auto text-sm text-dust">{count ? `${count} ticked` : "Nothing ticked yet"}</span>
            <button type="button" onClick={close} className={buttonStyles.secondary}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!count}
              onClick={() => {
                onPick([...selected.values()]);
                close();
              }}
              className={buttonStyles.primary}
            >
              {pickLabel(count)}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <label htmlFor={searchId} className="sr-only">
            Search photos
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file name, description or album"
            className={`${inputClass} min-w-56 grow`}
            autoFocus
          />
          <select value={albumId} onChange={(e) => setAlbumId(Number(e.target.value))} aria-label="Album" className={`${inputClass} w-auto max-w-72`}>
            <option value={0}>All photos</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {a.season_year ? ` (${seasonLabel(a.season_year)})` : ""}
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-8 text-center text-sm text-dust">
            {loading ? "Loading…" : query || albumId ? "No photos match." : "The library is empty. Upload some photos first."}
          </p>
        ) : (
          <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ${loading ? "opacity-70" : ""}`}>
            {items.map((it) => {
              const ticked = selected.has(it.id);
              const already = it.in_target === 1;
              const label = it.alt || it.filename;
              return (
                <li key={it.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => choose(it)}
                    aria-pressed={multiple ? ticked : undefined}
                    title={[it.filename, it.albums].filter(Boolean).join("\n")}
                    className={`group flex w-full flex-col gap-1.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hornet ${already ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <span
                      className={`relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-ink ${
                        ticked ? "border-hornet" : "border-transparent group-hover:border-edge"
                      }`}
                    >
                      <Thumb item={it} />
                      {multiple && !already && (
                        <span
                          aria-hidden="true"
                          className={`absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                            ticked ? "border-hornet bg-hornet text-ink" : "border-white/80 bg-black/40 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      )}
                      {already && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center font-label text-[11px] text-white">Already in it</span>
                      )}
                    </span>
                    <span className="truncate text-xs text-sand">{label}</span>
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
