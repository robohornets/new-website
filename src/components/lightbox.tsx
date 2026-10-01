"use client";

import { useEffect, useRef, useState } from "react";
import { mediaSrcSet, mediaUrl, originalUrl } from "@/lib/media";
import { ChevronLeft, ChevronRight, Close } from "./icons";

export type LightboxItem = {
  id: number;
  mediaKey: string;
  video: boolean;
  alt: string;
  description: string;
  width: number | null;
  height: number | null;
};

/**
 * A full-screen viewer for an album: the photo as big as the screen allows,
 * its description underneath, and ‹ › (arrow keys, or a swipe on a phone)
 * to move through the album without closing it. Esc or × closes.
 */
export function Lightbox({
  items,
  index,
  title,
  onIndex,
  onClose,
}: {
  items: LightboxItem[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const item = items[index];
  const total = items.length;
  const go = (step: number) => {
    const next = index + step;
    if (next >= 0 && next < total) onIndex(next);
  };

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // ← → between photos.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goRef.current(-1);
      if (e.key === "ArrowRight") goRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Swipe left/right on touch screens.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState(0);

  // Load the neighbours ahead of time so ‹ › feel instant.
  const neighbours = [items[index - 1], items[index + 1]].filter((n): n is LightboxItem => Boolean(n && !n.video));

  if (!item) return null;
  const nav =
    "absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0 md:size-14";

  return (
    <dialog
      ref={ref}
      aria-label={`${title}: photo ${index + 1} of ${total}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-bone backdrop:bg-black/80 open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 md:px-6">
        <p className="flex min-w-0 items-baseline gap-3">
          <span className="font-label text-sm tabular-nums text-sand">
            {index + 1} / {total}
          </span>
          <span className="truncate text-sm font-semibold">{title}</span>
        </p>
        <button type="button" onClick={onClose} aria-label="Close" autoFocus className="flex size-11 items-center justify-center rounded-full text-sand hover:bg-white/10 hover:text-white">
          <Close size={22} />
        </button>
      </header>

      <div
        className="relative flex min-h-0 grow touch-pan-y items-center justify-center px-2 md:px-20"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (swipe.current) setDrag(e.clientX - swipe.current.x);
        }}
        onPointerUp={(e) => {
          const start = swipe.current;
          swipe.current = null;
          setDrag(0);
          if (!start) return;
          const dx = e.clientX - start.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          swipe.current = null;
          setDrag(0);
        }}
        onClick={(e) => {
          // A click on the dark area around the photo closes, like most viewers.
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <button type="button" aria-label="Previous photo" disabled={index === 0} onClick={() => go(-1)} className={`${nav} left-2 md:left-5`}>
          <ChevronLeft size={26} />
        </button>
        {item.video ? (
          <video key={item.id} src={originalUrl(item.mediaKey) ?? ""} controls playsInline preload="metadata" className="max-h-full max-w-full rounded" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={mediaUrl(item.mediaKey, 1920) ?? ""}
            srcSet={mediaSrcSet(item.mediaKey, 1920)}
            sizes="100vw"
            width={item.width ?? undefined}
            height={item.height ?? undefined}
            alt={item.alt || item.description || `Photo ${index + 1} from ${title}`}
            style={drag ? { transform: `translateX(${drag}px)` } : undefined}
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
          />
        )}
        <button type="button" aria-label="Next photo" disabled={index === total - 1} onClick={() => go(1)} className={`${nav} right-2 md:right-5`}>
          <ChevronRight size={26} />
        </button>
      </div>

      <footer className="flex shrink-0 justify-center px-4 pt-3 pb-5 md:px-6">
        {item.description ? (
          <p className="max-h-[22dvh] max-w-3xl overflow-y-auto text-center text-[15px] leading-relaxed whitespace-pre-line text-sand md:text-base">{item.description}</p>
        ) : (
          <p className="text-center text-xs text-ash">
            <span className="hidden md:inline">Use ← → to browse, Esc to close</span>
            <span className="md:hidden">Swipe to browse</span>
          </p>
        )}
      </footer>

      <div hidden aria-hidden="true">
        {neighbours.map((n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={n.id} src={mediaUrl(n.mediaKey, 1920) ?? ""} srcSet={mediaSrcSet(n.mediaKey, 1920)} sizes="100vw" alt="" loading="eager" />
        ))}
      </div>
    </dialog>
  );
}

/**
 * Open/close state for a Lightbox, kept in the address bar as #photo-<id>:
 * a link can open a photo directly, and the phone's back button closes the
 * viewer instead of leaving the page.
 */
export function useLightbox(items: LightboxItem[]) {
  const [index, setIndex] = useState<number | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const fromHash = () => {
      const id = Number(/^#photo-(\d+)$/.exec(location.hash)?.[1]);
      const i = items.findIndex((it) => it.id === id);
      setIndex(i >= 0 ? i : null);
      if (i < 0) pushed.current = false;
    };
    fromHash();
    window.addEventListener("popstate", fromHash);
    return () => window.removeEventListener("popstate", fromHash);
  }, [items]);

  const open = (i: number) => {
    const item = items[i];
    if (!item) return;
    history.pushState(history.state, "", `#photo-${item.id}`);
    pushed.current = true;
    setIndex(i);
  };
  const move = (i: number) => {
    const item = items[i];
    if (!item) return;
    history.replaceState(history.state, "", `#photo-${item.id}`);
    setIndex(i);
  };
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else {
      history.replaceState(history.state, "", location.pathname + location.search);
    }
    setIndex(null);
  };
  return { index, open, move, close };
}
