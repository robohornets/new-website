"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "@/components/icons";
import type { ActionState } from "@/lib/admin";
import { downloadUrl, isVideo, mediaUrl, originalUrl } from "@/lib/media";
import { inputClass } from "./fields";
import { buttonStyles } from "./items";
import { Modal, useConfirm } from "./modal";
import { SortableGrid } from "./sortable";
import { removeAlbumPhoto, saveAlbumPhotoOrder, setAlbumCover, updateAlbumPhoto } from "../gallery/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;
type Simple = (prev: ActionState) => Promise<ActionState>;

export type EditorPhoto = { media_id: number; r2_key: string; alt: string; caption: string; filename: string };

/**
 * An album's photos, in the order the site shows them. Drag to reorder (the
 * save bar saves it); click a photo to describe it, make it the cover or
 * remove it. In the popup, ‹ › (or the arrow keys) move to the next photo,
 * saving as you go.
 */
export function PhotosEditor({
  albumId,
  photos,
  coverId,
  coverLabel = "Make cover",
}: {
  albumId: number;
  photos: EditorPhoto[];
  coverId: number | null;
  /** "Make main photo" on a robot's page. */
  coverLabel?: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const index = photos.findIndex((p) => p.media_id === openId);
  // The first image is the cover when none was picked.
  const effectiveCover = coverId ?? photos.find((p) => !isVideo(p.r2_key))?.media_id ?? null;

  return (
    <>
      <SortableGrid
        action={saveAlbumPhotoOrder.bind(null, albumId)}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        items={photos.map((p, i) => ({
          id: p.media_id,
          label: p.alt || `photo ${i + 1}`,
          node: (
            <button
              type="button"
              onClick={() => setOpenId(p.media_id)}
              aria-haspopup="dialog"
              aria-label={`Edit photo ${i + 1}${p.caption ? `: ${p.caption}` : ""}`}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-line bg-panel text-left hover:border-edge focus-visible:border-hornet"
            >
              {isVideo(p.r2_key) ? (
                <video src={originalUrl(p.r2_key) ?? ""} preload="metadata" muted className="size-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(p.r2_key, 640) ?? ""} alt="" loading="lazy" className="size-full object-cover" />
              )}
              {effectiveCover === p.media_id && (
                <span className="absolute top-2 left-2 rounded bg-ink/90 px-2 py-0.5 font-label text-[10px] text-hornet">COVER</span>
              )}
              {isVideo(p.r2_key) && <span className="absolute bottom-2 left-2 rounded bg-ink/90 px-2 py-0.5 font-label text-[10px] text-sand">VIDEO</span>}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-2.5 pt-6 pb-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="truncate text-bone">{p.caption || "Add a description"}</span>
                <Pencil size={14} className="shrink-0 text-bone" />
              </span>
            </button>
          ),
        }))}
      />
      {openId !== null && index !== -1 && (
        <PhotoModal
          key={openId}
          photo={photos[index]}
          position={{ index, total: photos.length }}
          isCover={effectiveCover === openId}
          coverLabel={coverLabel}
          save={(prev, fd) => updateAlbumPhoto(albumId, openId, prev, fd)}
          setCover={(prev) => setAlbumCover(albumId, openId, prev)}
          remove={(prev) => removeAlbumPhoto(albumId, openId, prev)}
          onMove={(step) => {
            const next = photos[index + step];
            if (next) setOpenId(next.media_id);
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

function PhotoModal({
  photo,
  position,
  isCover,
  coverLabel,
  save,
  setCover,
  remove,
  onMove,
  onClose,
}: {
  photo: EditorPhoto;
  position: { index: number; total: number };
  isCover: boolean;
  coverLabel: string;
  save: Action;
  setCover: Simple;
  remove: Simple;
  onMove: (step: -1 | 1) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const changed = () => {
    const f = formRef.current;
    if (!f) return false;
    const field = (n: string) => f.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null;
    return (field("caption")?.value ?? "") !== photo.caption || (field("alt")?.value ?? "") !== photo.alt;
  };

  /** Saves if anything changed, then runs `then`. */
  const saveThen = (then: () => void) => {
    if (!changed() || !formRef.current) return then();
    const fd = new FormData(formRef.current);
    setError(null);
    startTransition(async () => {
      const result = await save({ ok: false }, fd);
      if (!result.ok) return setError(result.error ?? "That didn't save.");
      router.refresh();
      then();
    });
  };
  const run = (action: Simple, then: () => void) =>
    startTransition(async () => {
      const result = await action({ ok: false });
      if (!result.ok) return setError(result.error ?? "That didn't work.");
      router.refresh();
      then();
    });

  async function requestClose() {
    if (pending) return;
    if (changed() && !(await confirm({ title: "Discard changes?", message: "Close this photo without saving your changes?", confirmLabel: "Discard", cancelLabel: "Keep editing", danger: true }))) return;
    onClose();
  }

  // ← → move between photos while you're not typing.
  const moveRef = useRef(onMove);
  const saveRef = useRef(saveThen);
  useEffect(() => {
    moveRef.current = onMove;
    saveRef.current = saveThen;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") saveRef.current(() => moveRef.current(-1));
      if (e.key === "ArrowRight") saveRef.current(() => moveRef.current(1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const video = isVideo(photo.r2_key);
  const first = position.index === 0;
  const last = position.index === position.total - 1;
  const nav = "flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-ink/80 text-bone hover:border-bone disabled:opacity-30";

  return (
    <Modal
      open
      onClose={requestClose}
      size="lg"
      title={`Photo ${position.index + 1} of ${position.total}`}
      description={photo.filename}
      footer={
        <>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (await confirm({ message: "Remove this photo from the album? It stays in the Media library.", confirmLabel: "Remove", danger: true })) {
                run(remove, onClose);
              }
            }}
            className={`${buttonStyles.danger} mr-auto`}
          >
            Remove from album
          </button>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {!video && !isCover && (
            <button type="button" disabled={pending} onClick={() => run(setCover, () => undefined)} className={buttonStyles.secondary}>
              {coverLabel}
            </button>
          )}
          <button type="button" onClick={requestClose} className={buttonStyles.quiet}>
            Cancel
          </button>
          <button type="button" disabled={pending} onClick={() => saveThen(onClose)} className={buttonStyles.primary}>
            {pending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Previous photo" disabled={first || pending} onClick={() => saveThen(() => onMove(-1))} className={nav}>
            <ChevronLeft size={20} />
          </button>
          <div className="flex h-[min(46vh,420px)] min-w-0 grow items-center justify-center overflow-hidden rounded-md bg-ink">
            {video ? (
              <video src={originalUrl(photo.r2_key) ?? ""} controls preload="metadata" className="max-h-full max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(photo.r2_key, 960) ?? ""} alt={photo.alt} className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <button type="button" aria-label="Next photo" disabled={last || pending} onClick={() => saveThen(() => onMove(1))} className={nav}>
            <ChevronRight size={20} />
          </button>
        </div>
        {isCover && <p className="text-sm text-hornet">This is the cover{coverLabel !== "Make cover" ? " (the main photo)" : ""}.</p>}
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            saveThen(onClose);
          }}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Description
            <textarea name="caption" defaultValue={photo.caption} rows={3} maxLength={1000} placeholder="What's happening in this photo? Shown when someone opens it on the site." className={`${inputClass} h-auto py-2.5 leading-relaxed`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Alt text
            <input name="alt" defaultValue={photo.alt} maxLength={300} placeholder="Drive team celebrating in the pits" className={inputClass} />
            <span className="text-xs font-normal text-dust">One short sentence for people using screen readers.</span>
          </label>
        </form>
        <a href={downloadUrl(photo.r2_key) ?? ""} className="text-sm font-semibold text-hornet hover:text-hornet-hover">
          Download original
        </a>
      </div>
    </Modal>
  );
}
