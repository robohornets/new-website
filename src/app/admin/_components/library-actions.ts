"use server";

import { getSeasonYears } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { searchMedia, type MediaKind, type MediaRow, type MediaSort } from "@/lib/media-search";

export type LibraryItem = MediaRow & {
  /** 1 if it's already in the album being added to. */
  in_target: number;
};

export type LibraryAlbum = { id: number; title: string; season_year: number | null; photos: number; cover_key: string | null };

const PAGE = 48;

/** One page of the media library for the picker, filtered like the Media library page. */
export async function searchLibrary(opts: {
  q?: string;
  kinds: MediaKind[];
  albumId?: number;
  season?: number;
  used?: "" | "used" | "unused";
  sort?: MediaSort;
  targetAlbumId?: number | null;
  offset?: number;
}): Promise<{ items: LibraryItem[]; more: boolean }> {
  await requireAdmin();
  return searchMedia(
    { q: opts.q, kinds: opts.kinds, albumId: opts.albumId, season: opts.season, used: opts.used, sort: opts.sort },
    { limit: PAGE, offset: opts.offset ?? 0 },
    opts.targetAlbumId,
  );
}

/** Every album with its cover, for the album filter and the album chooser. */
export async function listAlbums(): Promise<LibraryAlbum[]> {
  await requireAdmin();
  return all<LibraryAlbum>(
    `SELECT a.id, a.title, a.season_year, (SELECT COUNT(*) FROM album_photos ap WHERE ap.album_id = a.id) AS photos,
            (SELECT mi.r2_key FROM media mi WHERE mi.id = COALESCE(a.cover_media_id,
               (SELECT ap.media_id FROM album_photos ap JOIN media x ON x.id = ap.media_id
                WHERE ap.album_id = a.id AND x.content_type LIKE 'image/%' ORDER BY ap.sort_order LIMIT 1))) AS cover_key
     FROM albums a ORDER BY a.season_year IS NULL, a.season_year DESC, a.sort_order, a.created_at DESC`,
  );
}

/** The seasons, for the season filter. */
export async function listSeasons(): Promise<number[]> {
  await requireAdmin();
  return getSeasonYears();
}
