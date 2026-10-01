"use client";

import { mediaSrcSet, mediaUrl, originalUrl } from "@/lib/media";
import { Expand, Play } from "./icons";
import { Lightbox, useLightbox, type LightboxItem } from "./lightbox";

/**
 * An album's photos as a masonry grid. Every photo opens the viewer, and
 * shows it: a zoom-in cursor, an expand icon (always visible on touch
 * screens, on hover elsewhere) and the start of its description.
 */
export function AlbumGrid({ items, title }: { items: LightboxItem[]; title: string }) {
  const viewer = useLightbox(items);
  return (
    <>
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {items.map((it, i) => (
          <li key={it.id} className="mb-4 break-inside-avoid">
            <button
              type="button"
              onClick={() => viewer.open(i)}
              aria-label={`Open photo ${i + 1}${it.description ? `: ${it.description.slice(0, 80)}` : ""}`}
              className="group relative block w-full cursor-zoom-in overflow-hidden rounded-md bg-panel text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hornet"
            >
              {it.video ? (
                <video src={`${originalUrl(it.mediaKey) ?? ""}#t=0.5`} preload="metadata" muted playsInline className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(it.mediaKey, 960) ?? ""}
                  srcSet={mediaSrcSet(it.mediaKey, 1280)}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  width={it.width ?? undefined}
                  height={it.height ?? undefined}
                  alt={it.alt || it.description || `Photo ${i + 1} from ${title}`}
                  loading="lazy"
                  className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]"
                />
              )}
              {it.video && (
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <span className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white">
                    <Play size={24} />
                  </span>
                </span>
              )}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <span className="line-clamp-2 text-sm text-white">{it.description}</span>
              </span>
              <span
                aria-hidden="true"
                className="absolute top-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-opacity group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
              >
                <Expand size={16} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {viewer.index !== null && <Lightbox items={items} index={viewer.index} title={title} onIndex={viewer.move} onClose={viewer.close} />}
    </>
  );
}
