"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { ChevronLeft, ChevronRight, Expand, Pause, Play } from "./icons";
import { Lightbox, useLightbox, type LightboxItem } from "./lightbox";

const INTERVAL = 5000;

function subscribeReducedMotion(fn: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The robot's photos at the top of its season page. Moves on every 5 seconds;
 * hovering (or focusing) shows a control bar to go back and forth or pause,
 * and stops it moving meanwhile. Phones swipe and always see the controls.
 * Clicking a photo opens it full screen. With "reduce motion" on, it never
 * moves by itself.
 */
export function RobotSlideshow({ slides, label }: { slides: LightboxItem[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reduce = useSyncExternalStore(subscribeReducedMotion, reducedMotion, () => true);
  const viewer = useLightbox(slides);
  const count = slides.length;
  const playing = count > 1 && !reduce && !stopped && !hovering && viewer.index === null;

  // Advance every 5 seconds while playing; any change of slide restarts the clock.
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % count);
    }, INTERVAL);
    return () => clearTimeout(id);
  }, [playing, index, count]);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);
  const swipe = useRef<number | null>(null);

  if (count === 0) return null;
  const control = "flex size-9 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:bg-white/15";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="group/show absolute inset-0"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
      }}
    >
      <div
        aria-live={playing ? "off" : "polite"}
        className="absolute inset-0 touch-pan-y"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = e.clientX;
        }}
        onPointerUp={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (start !== null && Math.abs(e.clientX - start) > 40) {
            setStopped(true);
            go(e.clientX < start ? 1 : -1);
          }
        }}
      >
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}${s.description ? `: ${s.description.slice(0, 80)}` : ""}. Open full screen`}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            onClick={() => viewer.open(i)}
            className={`absolute inset-0 cursor-zoom-in transition-opacity duration-700 ease-out motion-reduce:transition-none ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(s.mediaKey, 1280) ?? ""}
              srcSet={mediaSrcSet(s.mediaKey, 1920)}
              sizes="(min-width: 1024px) 60vw, 100vw"
              alt={s.alt || label}
              loading={i === 0 ? "eager" : Math.abs(i - index) <= 1 || (index === count - 1 && i === 0) ? "eager" : "lazy"}
              className="size-full object-cover"
              draggable={false}
            />
          </button>
        ))}
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover/show:opacity-100"
      >
        <Expand size={18} />
      </span>

      {count > 1 && (
        <div
          className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-full bg-black/60 p-1 text-white backdrop-blur transition-opacity duration-200 group-hover/show:opacity-100 group-focus-within/show:opacity-100 [@media(hover:hover)]:opacity-0"
        >
          <button type="button" aria-label="Previous photo" onClick={() => (setStopped(true), go(-1))} className={control}>
            <ChevronLeft size={18} />
          </button>
          {count <= 10 ? (
            <span className="flex items-center gap-1.5 px-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => (setStopped(true), setIndex(i))}
                  className={`h-2 rounded-full transition-all ${i === index ? "w-5 bg-hornet" : "w-2 bg-white/50 hover:bg-white"}`}
                />
              ))}
            </span>
          ) : (
            <span className="px-2 font-label text-xs tabular-nums">
              {index + 1} / {count}
            </span>
          )}
          <button type="button" aria-label="Next photo" onClick={() => (setStopped(true), go(1))} className={control}>
            <ChevronRight size={18} />
          </button>
          {!reduce && (
            <button
              type="button"
              aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
              onClick={() => setStopped((s) => !s)}
              className={control}
            >
              {stopped ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div>
      )}

      {viewer.index !== null && <Lightbox items={slides} index={viewer.index} title={label} onIndex={viewer.move} onClose={viewer.close} />}
    </section>
  );
}
