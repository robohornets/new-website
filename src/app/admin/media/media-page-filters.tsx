"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MediaFilterBar, NO_FILTERS, type FilterValue, type Kind } from "../_components/media-filters";

const KINDS: Kind[] = ["image", "video", "pdf", "other"];

/** The Media library's filters, kept in the address so links and Back keep them. */
export function MediaPageFilters({ initial, albums, seasons }: { initial: FilterValue; albums: { id: number; title: string; season_year: number | null }[]; seasons: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function go(next: FilterValue) {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.kind) params.set("type", next.kind);
    if (next.albumId) params.set("album", String(next.albumId));
    if (next.season) params.set("season", String(next.season));
    if (next.used) params.set("used", next.used);
    if (next.sort !== NO_FILTERS.sort) params.set("sort", next.sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <MediaFilterBar
      value={value}
      kinds={KINDS}
      albums={albums}
      seasons={seasons}
      onChange={(patch) => {
        const next = { ...value, ...patch };
        setValue(next);
        if (timer.current) clearTimeout(timer.current);
        // Typing waits for a pause; the menus apply straight away.
        if ("q" in patch && Object.keys(patch).length === 1) timer.current = setTimeout(() => go(next), 300);
        else go(next);
      }}
    />
  );
}
