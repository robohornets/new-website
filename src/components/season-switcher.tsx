"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const RECENT = 3;

type Variant = "admin" | "rail" | "pill";

const STYLES: Record<Variant, { chip: string; active: string; idle: string; more: string }> = {
  admin: {
    chip: "flex h-9 shrink-0 items-center rounded-md px-3 font-label text-sm",
    active: "bg-hornet font-bold text-ink",
    idle: "text-sand hover:bg-raise",
    more: "flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm font-semibold text-sand hover:border-bone hover:text-bone",
  },
  rail: {
    chip: "flex h-11 shrink-0 items-center rounded-md px-4 font-label text-sm",
    active: "bg-hornet font-bold text-ink",
    idle: "text-sand hover:bg-raise",
    more: "flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-4 text-sm font-semibold text-sand hover:border-bone hover:text-bone",
  },
  pill: {
    chip: "flex h-11 shrink-0 items-center rounded-full px-5 font-label text-sm",
    active: "bg-bone font-bold text-ink",
    idle: "border border-line-strong text-sand hover:border-bone",
    more: "flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-5 text-sm font-semibold text-sand hover:border-bone hover:text-bone",
  },
};

/**
 * The newest few seasons as buttons, and every other year in an "Older
 * seasons" panel grouped by decade. An older year that's selected shows as
 * its own highlighted button so it's clear where you are.
 *
 * `href` is a pattern with {year} in it, e.g. "/seasons/{year}".
 */
export function SeasonSwitcher({
  years,
  current,
  href,
  label,
  variant = "admin",
  all,
}: {
  years: number[];
  current: number | null;
  href: string;
  label?: string;
  variant?: Variant;
  /** An "All" option before the years (the gallery's filter). */
  all?: { label: string; href: string };
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const style = STYLES[variant];
  const sorted = [...years].sort((a, b) => b - a);
  const recent = sorted.slice(0, RECENT);
  const older = sorted.slice(RECENT);
  const currentIsOlder = current !== null && older.includes(current);
  const link = (y: number) => href.replace("{year}", String(y));

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (years.length === 0 && !all) return null;

  const decades = new Map<number, number[]>();
  for (const y of older) {
    const d = Math.floor(y / 10) * 10;
    decades.set(d, [...(decades.get(d) ?? []), y]);
  }

  const chip = (y: number) => (
    <Link
      key={y}
      href={link(y)}
      aria-current={y === current ? "page" : undefined}
      className={`${style.chip} ${y === current ? style.active : style.idle}`}
    >
      {y}
    </Link>
  );

  return (
    <div ref={wrapRef} className="relative flex flex-wrap items-center gap-1.5">
      {label && <span className="eyebrow mr-2 text-[11px] text-ash">{label}</span>}
      {all && (
        <Link href={all.href} aria-current={current === null ? "page" : undefined} className={`${style.chip} ${current === null ? style.active : style.idle}`}>
          {all.label}
        </Link>
      )}
      {recent.map(chip)}
      {currentIsOlder && chip(current)}
      {older.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className={style.more}
        >
          Older seasons
          <span aria-hidden="true" className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
      )}
      {open && (
        <div
          id={panelId}
          className="absolute top-full left-0 z-30 mt-2 flex w-[min(360px,calc(100vw-32px))] animate-rise flex-col gap-3 rounded-lg border border-line-strong bg-panel p-4 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          {[...decades.entries()].map(([decade, list]) => (
            <div key={decade} className="grid grid-cols-[56px_1fr] items-start gap-2">
              <span className="pt-2 font-label text-xs font-bold text-ash">{decade}s</span>
              <div className="grid grid-cols-4 gap-1.5">
                {list.map((y) => (
                  <Link
                    key={y}
                    href={link(y)}
                    onClick={() => setOpen(false)}
                    aria-current={y === current ? "page" : undefined}
                    className={`flex h-9 items-center justify-center rounded-md font-label text-sm ${
                      y === current ? "bg-hornet font-bold text-ink" : "bg-ink text-sand hover:bg-raise hover:text-bone"
                    }`}
                  >
                    {y}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
