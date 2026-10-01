"use server";

import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";

export type LibraryItem = {
  id: number;
  r2_key: string;
  filename: string;
  alt: string;
  content_type: string;
  created_at: string;
  /** Albums it's in, "Kickoff · 25-26 robot: Roomba". */
  albums: string;
  /** 1 if it's already in the album being added to. */
  in_target: number;
};

export type LibraryAlbum = { id: number; title: string; season_year: number | null; photos: number; cover_key: string | null };

const PAGE = 48;

/**
 * The media library for the photo picker, newest first: searched by file
 * name, alt text, description or album title, optionally just one album's.
 */
export async function searchLibrary(opts: {
  q?: string;
  albumId?: number | null;
  videos?: boolean;
  targetAlbumId?: number | null;
  offset?: number;
}): Promise<{ items: LibraryItem[]; more: boolean }> {
  await requireAdmin();
  const q = (opts.q ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await all<LibraryItem>(
    `SELECT m.id, m.r2_key, m.filename, m.alt, m.content_type, m.created_at,
            COALESCE((SELECT group_concat(a.title, ' · ') FROM album_photos ap JOIN albums a ON a.id = ap.album_id WHERE ap.media_id = m.id), '') AS albums,
            EXISTS (SELECT 1 FROM album_photos ap WHERE ap.media_id = m.id AND ap.album_id = ?) AS in_target
     FROM media m
     WHERE (m.content_type LIKE 'image/%' OR (? AND m.content_type LIKE 'video/%'))
       AND (? = '' OR m.filename LIKE ? ESCAPE '\\' OR m.alt LIKE ? ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM album_photos ap JOIN albums a ON a.id = ap.album_id
                       WHERE ap.media_id = m.id AND (a.title LIKE ? ESCAPE '\\' OR ap.caption LIKE ? ESCAPE '\\')))
       AND (? = 0 OR EXISTS (SELECT 1 FROM album_photos ap WHERE ap.media_id = m.id AND ap.album_id = ?))
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    opts.targetAlbumId ?? 0,
    opts.videos ? 1 : 0,
    q,
    like,
    like,
    like,
    like,
    opts.albumId ?? 0,
    opts.albumId ?? 0,
    PAGE + 1,
    Math.max(0, opts.offset ?? 0),
  );
  return { items: rows.slice(0, PAGE), more: rows.length > PAGE };
}

/** Every album with its cover, for the picker's album filter and the album chooser. */
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
