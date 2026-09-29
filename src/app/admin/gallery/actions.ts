"use server";

import { redirect } from "next/navigation";
import { adminAction, bool, FormError, int, optionalInt, str, type ActionState } from "@/lib/admin";
import { first, run } from "@/lib/db";
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
      "INSERT INTO albums (slug, title, description, season_year, published) VALUES (?, ?, ?, ?, ?) RETURNING id",
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
    await run(
      "UPDATE album_photos SET caption = ?, sort_order = ? WHERE album_id = ? AND media_id = ?",
      str(fd, "caption", 300),
      int(fd, "sort_order", 0),
      albumId,
      mediaId,
    );
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
