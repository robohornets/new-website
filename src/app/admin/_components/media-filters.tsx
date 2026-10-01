"use client";

import { useId } from "react";
import { seasonLabel } from "@/lib/format";
import { inputClass } from "./fields";

export type Kind = "image" | "video" | "pdf" | "other";
export type FilterValue = { q: string; kind: Kind | ""; albumId: number; season: number; used: "" | "used" | "unused"; sort: "new" | "old" | "big" | "name" };
export const NO_FILTERS: FilterValue = { q: "", kind: "", albumId: 0, season: 0, used: "", sort: "new" };

const KIND_LABEL: Record<Kind, string> = { image: "Photos", video: "Videos", pdf: "PDFs", other: "Other files" };

/**
 * Search and filters for the media library: what it is, which album or
 * season it's from, whether it's used anywhere, and the order. `kinds` are
 * the types that make sense here (a logo can't be a video); the type filter
 * only shows when there's a choice.
 */
export function MediaFilterBar({
  value,
  onChange,
  kinds,
  albums,
  seasons,
}: {
  value: FilterValue;
  onChange: (next: Partial<FilterValue>) => void;
  kinds: Kind[];
  albums: { id: number; title: string; season_year: number | null }[];
  seasons: number[];
}) {
  const id = useId();
  const select = `${inputClass} w-auto min-w-0 max-w-full sm:max-w-60`;
  const filtered = value.q || value.kind || value.albumId || value.season || value.used;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-q`} className="sr-only">
        Search
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={value.q}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder="Search by file name, description or album"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2">
        {kinds.length > 1 && (
          <select value={value.kind} onChange={(e) => onChange({ kind: e.target.value as Kind | "" })} aria-label="Type of file" className={select}>
            <option value="">All types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        )}
        <select value={value.albumId} onChange={(e) => onChange({ albumId: Number(e.target.value) })} aria-label="Album" className={select}>
          <option value={0}>Any album</option>
          {albums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
              {a.season_year ? ` (${seasonLabel(a.season_year)})` : ""}
            </option>
          ))}
        </select>
        <select value={value.season} onChange={(e) => onChange({ season: Number(e.target.value) })} aria-label="Season" className={select}>
          <option value={0}>Any season</option>
          {seasons.map((y) => (
            <option key={y} value={y}>
              {seasonLabel(y)} season
            </option>
          ))}
        </select>
        <select value={value.used} onChange={(e) => onChange({ used: e.target.value as FilterValue["used"] })} aria-label="Used or not" className={select}>
          <option value="">Used or not</option>
          <option value="used">Used somewhere</option>
          <option value="unused">Not used anywhere</option>
        </select>
        <select value={value.sort} onChange={(e) => onChange({ sort: e.target.value as FilterValue["sort"] })} aria-label="Order" className={select}>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="big">Biggest first</option>
          <option value="name">By file name</option>
        </select>
        {filtered && (
          <button type="button" onClick={() => onChange({ ...NO_FILTERS, sort: value.sort })} className="h-10 px-2 text-sm text-dust hover:text-bone">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
