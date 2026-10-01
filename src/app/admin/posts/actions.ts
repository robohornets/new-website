"use server";

import { redirect } from "next/navigation";
import { adminAction, bool, FormError, optionalInt, str, type ActionState } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { first, run } from "@/lib/db";
import { slugify } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";

/** Starts a draft from a title and opens it, where the rest (and the photos) go. */
export async function createPost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "post", entityId: str(fd, "title") }, async () => {
    const title = str(fd, "title", 200);
    if (!title) throw new FormError("Give the post a title.");
    const row = await first<{ id: number }>(
      `INSERT INTO posts (slug, title, category, season_year, published)
       VALUES (?, ?, 'outreach', ?, 0) RETURNING id`,
      slugify(title),
      title,
      optionalInt(fd, "season_year"),
    );
    id = row?.id ?? 0;
  });
  if (result.ok && id) redirect(`/admin/posts/${id}?created=1`);
  return result;
}

export async function updatePost(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "post", entityId: id }, async () => {
    const title = str(fd, "title", 200);
    if (!title) throw new FormError("Give the post a title.");
    const before = await first<{ title: string; album_id: number | null }>("SELECT title, album_id FROM posts WHERE id = ?", id);
    if (!before) throw new FormError("That post no longer exists.");
    const published = bool(fd, "published");
    const dateRaw = str(fd, "published_at", 40);
    const publishedAt = dateRaw ? new Date(`${dateRaw.slice(0, 10)}T12:00:00Z`).toISOString() : published ? new Date().toISOString() : null;
    const seasonYear = optionalInt(fd, "season_year");
    await run(
      `UPDATE posts SET slug = ?, title = ?, excerpt = ?, body = ?, season_year = ?, published = ?, published_at = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      slugify(str(fd, "slug", 100) || title),
      title,
      str(fd, "excerpt", 400),
      str(fd, "body", 100_000),
      seasonYear,
      published,
      publishedAt,
      id,
    );
    // The post's own album follows it: same season, in the Gallery only while
    // the post is published, and renamed with it unless someone renamed it.
    if (before.album_id) {
      await run(
        `UPDATE albums SET season_year = ?, published = ?, title = CASE WHEN title = ? THEN ? ELSE title END
         WHERE id = ? AND slug = ?`,
        seasonYear,
        published,
        before.title,
        title,
        before.album_id,
        `post-${id}`,
      );
    }
  });
}

/** Puts a post from the old News section on the Impact page. */
export async function moveToImpact(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "update", entity: "post", entityId: id }, async () => {
    await run("UPDATE posts SET category = 'outreach' WHERE id = ?", id);
    return "It's an outreach post now.";
  });
}

/**
 * The album a post's photos go into, made with the first upload. Shown in
 * the Gallery while the post is published.
 */
export async function ensurePostAlbum(id: number): Promise<number> {
  const user = await requireAdmin();
  const post = await first<{ title: string; season_year: number | null; published: number; album_id: number | null }>(
    "SELECT title, season_year, published, album_id FROM posts WHERE id = ?",
    id,
  );
  if (!post) throw new Error("That post no longer exists.");
  if (post.album_id) return post.album_id;
  const album = await first<{ id: number }>(
    `INSERT INTO albums (slug, title, description, season_year, published, sort_order)
     VALUES (?, ?, '', ?, ?, (SELECT COALESCE(MIN(sort_order), 1) - 1 FROM albums))
     ON CONFLICT(slug) DO UPDATE SET slug = excluded.slug
     RETURNING id`,
    `post-${id}`,
    post.title,
    post.season_year,
    post.published,
  );
  if (!album) throw new Error("Couldn't make the post's album.");
  await run("UPDATE posts SET album_id = ? WHERE id = ?", album.id, id);
  await run("INSERT INTO audit_log (actor, action, entity, entity_id) VALUES (?, 'create', 'album', ?)", user.email, String(album.id));
  return album.id;
}

export async function deletePost(id: number, _prev: ActionState): Promise<ActionState> {
  const result = await adminAction({ action: "delete", entity: "post", entityId: id }, async () => {
    await run("DELETE FROM posts WHERE id = ?", id);
  });
  if (result.ok) redirect("/admin/posts");
  return result;
}

/** Renders Markdown for the editor's preview tab. */
export async function previewMarkdown(source: string): Promise<string> {
  await requireAdmin();
  return renderMarkdown(source.slice(0, 100_000));
}
