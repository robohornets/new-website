"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminAction, bool, FormError, oneOf, optionalInt, str, type ActionState } from "@/lib/admin";
import { first, run } from "@/lib/db";
import { slugify } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import type { PostCategory } from "@/lib/types";

const CATEGORIES: PostCategory[] = ["news", "outreach"];

function postFields(fd: FormData) {
  const title = str(fd, "title", 200);
  if (!title) throw new FormError("Give the post a title.");
  const slug = slugify(str(fd, "slug", 100) || title);
  const published = bool(fd, "published");
  const dateRaw = str(fd, "published_at", 40);
  const publishedAt = dateRaw ? new Date(`${dateRaw.slice(0, 10)}T12:00:00Z`).toISOString() : published ? new Date().toISOString() : null;
  return [
    slug,
    title,
    oneOf(fd, "category", CATEGORIES, "news"),
    str(fd, "excerpt", 400),
    str(fd, "body", 100_000),
    optionalInt(fd, "cover_media_id"),
    optionalInt(fd, "season_year"),
    published,
    publishedAt,
  ] as const;
}

export async function createPost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "post", entityId: str(fd, "title") }, async () => {
    const row = await first<{ id: number }>(
      `INSERT INTO posts (slug, title, category, excerpt, body, cover_media_id, season_year, published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ...postFields(fd),
    );
    id = row?.id ?? 0;
  });
  if (result.ok && id) redirect(`/admin/posts/${id}?created=1`);
  return result;
}

export async function updatePost(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "post", entityId: id }, async () => {
    await run(
      `UPDATE posts SET slug = ?, title = ?, category = ?, excerpt = ?, body = ?, cover_media_id = ?, season_year = ?,
         published = ?, published_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ...postFields(fd),
      id,
    );
  });
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
