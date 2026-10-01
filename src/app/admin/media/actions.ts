"use server";

import { adminAction, FormError, str, type ActionState } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { getEnv } from "@/lib/cf";
import { batch, first, run, all } from "@/lib/db";
import { unhashedBatch } from "@/lib/duplicates";

export async function updateMediaAlt(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction(null, async () => {
    await run("UPDATE media SET alt = ? WHERE id = ?", str(fd, "alt", 300), id);
  });
}

export async function deleteMedia(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "media", entityId: id }, async () => {
    const row = await first<{ r2_key: string }>("SELECT r2_key FROM media WHERE id = ?", id);
    if (!row) return "Already deleted.";
    // Rows that pointed at this file fall back to no image (ON DELETE SET NULL).
    await run("DELETE FROM media WHERE id = ?", id);
    await (await getEnv()).MEDIA.delete(row.r2_key);
    return "Deleted.";
  });
}

// ---- Duplicates ---------------------------------------------------------------------

/** The next photos for the browser to fingerprint (see the Duplicates page). */
export async function nextToFingerprint(): Promise<{ id: number; r2_key: string }[]> {
  await requireAdmin();
  return unhashedBatch(40);
}

/** Saves what the browser worked out: a 22-digit hash, or '' when it couldn't read the photo. */
export async function saveFingerprints(prints: { id: number; phash: string }[]): Promise<void> {
  await requireAdmin();
  const ok = prints.filter((p) => Number.isInteger(p.id) && (p.phash === "" || /^[0-9a-f]{22}$/.test(p.phash))).slice(0, 200);
  if (ok.length) await batch(ok.map((p) => ["UPDATE media SET phash = ? WHERE id = ? AND phash IS NULL", p.phash, p.id]));
}

/**
 * Keeps one file and swaps it in for its copies everywhere they're used
 * (albums with their descriptions and order, covers, robots, seasons,
 * sponsors, people, resources, the Strategic Plan, event videos), then
 * deletes the copies.
 */
export async function mergeMedia(keepId: number, removeIds: number[]): Promise<ActionState> {
  return adminAction({ action: "merge", entity: "media", entityId: keepId }, async () => {
    const keep = await first<{ id: number; r2_key: string; content_type: string; alt: string }>("SELECT id, r2_key, content_type, alt FROM media WHERE id = ?", keepId);
    if (!keep) throw new FormError("The file to keep no longer exists. Reload the page.");
    const ids = [...new Set(removeIds)].filter((n) => Number.isInteger(n) && n !== keepId).slice(0, 100);
    const copies = await all<{ id: number; r2_key: string; content_type: string; alt: string }>(
      "SELECT id, r2_key, content_type, alt FROM media WHERE id IN (SELECT value FROM json_each(?))",
      JSON.stringify(ids),
    );
    if (!copies.length) return "Already merged.";
    const kind = (t: string) => t.split("/")[0];
    if (copies.some((c) => kind(c.content_type) !== kind(keep.content_type))) throw new FormError("Only photos with photos and videos with videos can be merged.");

    const k = keep.id;
    const statements: [string, ...(string | number | null)[]][] = [];
    for (const c of copies) {
      statements.push(
        // In each album the copy was in, the kept file takes its place (and its description, if it had none there).
        [
          `INSERT OR IGNORE INTO album_photos (album_id, media_id, caption, sort_order)
           SELECT album_id, ?, caption, sort_order FROM album_photos WHERE media_id = ?`,
          k,
          c.id,
        ],
        [
          `UPDATE album_photos SET caption = (SELECT x.caption FROM album_photos x WHERE x.album_id = album_photos.album_id AND x.media_id = ?)
           WHERE media_id = ? AND caption = '' AND EXISTS (SELECT 1 FROM album_photos x WHERE x.album_id = album_photos.album_id AND x.media_id = ? AND x.caption != '')`,
          c.id,
          k,
          c.id,
        ],
        ["DELETE FROM album_photos WHERE media_id = ?", c.id],
        ["UPDATE albums SET cover_media_id = ? WHERE cover_media_id = ?", k, c.id],
        ["UPDATE robots SET photo_media_id = ? WHERE photo_media_id = ?", k, c.id],
        ["UPDATE seasons SET hero_media_id = ? WHERE hero_media_id = ?", k, c.id],
        ["UPDATE seasons SET notebook_media_id = ? WHERE notebook_media_id = ?", k, c.id],
        ["UPDATE sponsors SET logo_media_id = ? WHERE logo_media_id = ?", k, c.id],
        ["UPDATE people SET photo_media_id = ? WHERE photo_media_id = ?", k, c.id],
        ["UPDATE resources SET media_id = ? WHERE media_id = ?", k, c.id],
        ["UPDATE posts SET cover_media_id = ? WHERE cover_media_id = ?", k, c.id],
        [
          "UPDATE site_settings SET value = json_set(value, '$.media_id', ?) WHERE key = 'strategic_plan' AND CAST(json_extract(value, '$.media_id') AS INTEGER) = ?",
          k,
          c.id,
        ],
        ["UPDATE events SET highlight_video_url = replace(highlight_video_url, ?, ?) WHERE highlight_video_url LIKE '%' || ?", c.r2_key, keep.r2_key, c.r2_key],
        ["UPDATE media SET alt = ? WHERE id = ? AND alt = ''", c.alt, k],
        ["DELETE FROM media WHERE id = ?", c.id],
      );
    }
    await batch(statements);
    const env = await getEnv();
    await env.MEDIA.delete(copies.map((c) => c.r2_key));
    return `Merged: ${copies.length} ${copies.length === 1 ? "copy" : "copies"} removed, and everything that used ${copies.length === 1 ? "it" : "them"} now uses the one you kept.`;
  });
}

/** "These are different photos": not suggested as duplicates of each other again. */
export async function markDistinct(ids: number[]): Promise<ActionState> {
  return adminAction(null, async () => {
    const list = [...new Set(ids)].filter((n) => Number.isInteger(n)).sort((a, b) => a - b).slice(0, 50);
    const pairs: [string, number, number][] = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push(["INSERT OR IGNORE INTO media_distinct (a, b) VALUES (?, ?)", list[i], list[j]]);
    if (pairs.length) await batch(pairs);
    return "Kept as different photos.";
  });
}
