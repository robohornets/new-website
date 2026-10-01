"use server";

import { redirect } from "next/navigation";
import { adminAction, bool, FormError, optionalInt, str, type ActionState } from "@/lib/admin";
import { batch, first, run } from "@/lib/db";
import { slugify } from "@/lib/format";

function albumFields(fd: FormData) {
  const title = str(fd, "title", 160);
  if (!title) throw new FormError("Give the album a title.");
  const seasonYear = optionalInt(fd, "season_year");
  const slug = slugify(str(fd, "slug", 100) || `${seasonYear ?? ""} ${title}`);
  return [slug, title, str(fd, "description", 1000), seasonYear, bool(fd, "published")] as const;
}

export async function createAlbum(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "album", entityId: str(fd, "title") }, async () => {
    const row = await first<{ id: number }>(
      // New albums go first; drag them elsewhere on the Gallery page.
      `INSERT INTO albums (slug, title, description, season_year, published, sort_order)
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MIN(sort_order), 1) - 1 FROM albums)) RETURNING id`,
      ...albumFields(fd),
    );
    id = row?.id ?? 0;
  });
  if (result.ok && id) redirect(`/admin/gallery/${id}`);
  return result;
}

export async function updateAlbum(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "album", entityId: id }, async () => {
    await run(
      "UPDATE albums SET slug = ?, title = ?, description = ?, season_year = ?, published = ?, cover_media_id = ? WHERE id = ?",
      ...albumFields(fd),
      optionalInt(fd, "cover_media_id"),
      id,
    );
  });
}

export async function deleteAlbum(id: number, _prev: ActionState): Promise<ActionState> {
  const result = await adminAction({ action: "delete", entity: "album", entityId: id }, async () => {
    // Photos stay in the media library; only the album and its ordering go.
    await run("DELETE FROM albums WHERE id = ?", id);
  });
  if (result.ok) redirect("/admin/gallery");
  return result;
}

export async function updateAlbumPhoto(albumId: number, mediaId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction(null, async () => {
    // Their order is saved separately (saveAlbumPhotoOrder), from the drag handles.
    // "caption" is shown as the photo's Description.
    await run("UPDATE album_photos SET caption = ? WHERE album_id = ? AND media_id = ?", str(fd, "caption", 1000), albumId, mediaId);
    await run("UPDATE media SET alt = ? WHERE id = ?", str(fd, "alt", 300), mediaId);
  });
}

export async function setAlbumCover(albumId: number, mediaId: number, _prev: ActionState): Promise<ActionState> {
  return adminAction(null, async () => {
    await run("UPDATE albums SET cover_media_id = ? WHERE id = ?", mediaId, albumId);
    return "Cover set.";
  });
}

export async function removeAlbumPhoto(albumId: number, mediaId: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "remove_photo", entity: "album", entityId: albumId }, async () => {
    await run("DELETE FROM album_photos WHERE album_id = ? AND media_id = ?", albumId, mediaId);
    await run("UPDATE albums SET cover_media_id = NULL WHERE id = ? AND cover_media_id = ?", albumId, mediaId);
    return "Removed from album.";
  });
}

/** "3,1,2" from a drag-and-drop list → [3, 1, 2], or an error if it's not a list of ids. */
function idList(fd: FormData): number[] {
  const ids = str(fd, "order", 20_000)
    .split(",")
    .filter(Boolean)
    .map(Number);
  if (ids.some((n) => !Number.isInteger(n) || n <= 0) || new Set(ids).size !== ids.length) {
    throw new FormError("That order didn't make sense. Reload the page and try again.");
  }
  return ids;
}

/** The order of albums on the Gallery page (and on each season's page). */
export async function saveAlbumOrder(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "reorder", entity: "albums" }, async () => {
    const ids = idList(fd);
    if (ids.length) await batch(ids.map((id, i) => ["UPDATE albums SET sort_order = ? WHERE id = ?", i + 1, id]));
    return "Album order saved.";
  });
}

/** The order of photos inside one album. */
export async function saveAlbumPhotoOrder(albumId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "reorder", entity: "album", entityId: albumId }, async () => {
    const ids = idList(fd);
    if (ids.length) {
      await batch(ids.map((mediaId, i) => ["UPDATE album_photos SET sort_order = ? WHERE album_id = ? AND media_id = ?", i + 1, albumId, mediaId]));
    }
    return "Photo order saved.";
  });
}
