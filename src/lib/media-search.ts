import "server-only";
import { all, first } from "./db";
import { USED_SQL } from "./media-usage";

// Searching the media library, shared by the Media library page and the
// photo picker.

export type MediaKind = "image" | "video" | "pdf" | "other";
export type MediaSort = "new" | "old" | "big" | "name";

export type MediaFilters = {
  q?: string;
  /** Which kinds of file to show; empty means every kind. */
  kinds?: MediaKind[];
  albumId?: number | null;
  /** Uploaded during the season (June to May) or in one of its albums. */
  season?: number | null;
  used?: "used" | "unused" | "";
  sort?: MediaSort;
};

export type MediaRow = {
  id: number;
  r2_key: string;
  filename: string;
  alt: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
  /** Albums it's in, "Kickoff · 25-26 robot: Roomba". */
  albums: string;
};

const KIND_SQL: Record<MediaKind, string> = {
  image: "m.content_type LIKE 'image/%'",
  video: "m.content_type LIKE 'video/%'",
  pdf: "m.content_type = 'application/pdf'",
  other: "(m.content_type NOT LIKE 'image/%' AND m.content_type NOT LIKE 'video/%' AND m.content_type != 'application/pdf')",
};

const ORDER: Record<MediaSort, string> = {
  new: "m.created_at DESC, m.id DESC",
  old: "m.created_at, m.id",
  big: "m.size_bytes DESC, m.id DESC",
  name: "m.filename COLLATE NOCASE, m.id",
};

function where(f: MediaFilters): { sql: string; params: (string | number)[] } {
  const parts: string[] = [];
  const params: (string | number)[] = [];
  const kinds = (f.kinds ?? []).filter((k) => k in KIND_SQL);
  if (kinds.length) parts.push(`(${kinds.map((k) => KIND_SQL[k]).join(" OR ")})`);
  // instr rather than LIKE: D1 refuses LIKE patterns over 50 characters.
  const q = (f.q ?? "").trim().slice(0, 100).toLowerCase();
  if (q) {
    parts.push(`(instr(lower(m.filename), ?) > 0 OR instr(lower(m.alt), ?) > 0
      OR EXISTS (SELECT 1 FROM album_photos ap JOIN albums a ON a.id = ap.album_id
                 WHERE ap.media_id = m.id AND (instr(lower(a.title), ?) > 0 OR instr(lower(ap.caption), ?) > 0)))`);
    params.push(q, q, q, q);
  }
  if (f.albumId) {
    parts.push("EXISTS (SELECT 1 FROM album_photos ap WHERE ap.media_id = m.id AND ap.album_id = ?)");
    params.push(f.albumId);
  }
  if (f.season) {
    parts.push(`(m.created_at >= ? AND m.created_at < ?
      OR EXISTS (SELECT 1 FROM album_photos ap JOIN albums a ON a.id = ap.album_id WHERE ap.media_id = m.id AND a.season_year = ?))`);
    params.push(`${f.season - 1}-06-01`, `${f.season}-06-01`, f.season);
  }
  if (f.used === "used") parts.push(USED_SQL);
  if (f.used === "unused") parts.push(`NOT ${USED_SQL}`);
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

/** One page of the library, plus whether there's more after it. `markAlbum` adds whether each is in that album. */
export async function searchMedia(
  f: MediaFilters,
  page: { limit: number; offset: number },
  markAlbum?: number | null,
): Promise<{ items: (MediaRow & { in_target: number })[]; more: boolean }> {
  const w = where(f);
  const rows = await all<MediaRow & { in_target: number }>(
    `SELECT m.id, m.r2_key, m.filename, m.alt, m.content_type, m.size_bytes, m.width, m.height, m.created_at,
            COALESCE((SELECT group_concat(a.title, ' · ') FROM album_photos ap JOIN albums a ON a.id = ap.album_id WHERE ap.media_id = m.id), '') AS albums,
            EXISTS (SELECT 1 FROM album_photos ap WHERE ap.media_id = m.id AND ap.album_id = ?) AS in_target
     FROM media m ${w.sql}
     ORDER BY ${ORDER[f.sort ?? "new"] ?? ORDER.new}
     LIMIT ? OFFSET ?`,
    markAlbum ?? 0,
    ...w.params,
    page.limit + 1,
    Math.max(0, page.offset),
  );
  return { items: rows.slice(0, page.limit), more: rows.length > page.limit };
}

/** How many files match, and how much space they take. */
export async function countMedia(f: MediaFilters): Promise<{ n: number; bytes: number }> {
  const w = where(f);
  const row = await first<{ n: number; bytes: number }>(`SELECT COUNT(*) AS n, COALESCE(SUM(m.size_bytes), 0) AS bytes FROM media m ${w.sql}`, ...w.params);
  return row ?? { n: 0, bytes: 0 };
}
