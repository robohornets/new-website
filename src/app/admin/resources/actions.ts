"use server";

import { adminAction, FormError, optionalInt, str, url, type ActionState } from "@/lib/admin";
import { first, run } from "@/lib/db";
import { seasonLabel } from "@/lib/format";

/** Title, description, and a link or an uploaded PDF (the DocumentField named "link"). */
function fields(fd: FormData) {
  const title = str(fd, "title", 160);
  if (!title) throw new FormError("Give it a title.");
  const mediaId = optionalInt(fd, "link_media_id");
  const link = url(fd, "link_url");
  if (!mediaId && !link) throw new FormError("Add a link or upload a file.");
  // "Shows on": a season, or "all" for a team document shown on every season.
  const team = str(fd, "season", 10) === "all";
  return { title, description: str(fd, "description", 500), link, mediaId, team, year: team ? null : optionalInt(fd, "season") };
}

export async function createResource(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "resource", entityId: year }, async () => {
    const f = fields(fd);
    await run(
      `INSERT INTO resources (season_year, title, description, url, media_id, sort_order)
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM resources))`,
      f.team ? null : (f.year ?? year),
      f.title,
      f.description,
      f.link,
      f.mediaId,
    );
    return f.team ? "Added to every season's Resources." : "Resource added.";
  });
}

export async function updateResource(id: number, year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "resource", entityId: id }, async () => {
    const f = fields(fd);
    const row = await first<{ season_year: number | null }>("SELECT season_year FROM resources WHERE id = ?", id);
    if (!row) throw new FormError("That resource no longer exists.");
    await run(
      "UPDATE resources SET season_year = ?, title = ?, description = ?, url = ?, media_id = ? WHERE id = ?",
      f.team ? null : (f.year ?? row.season_year ?? year),
      f.title,
      f.description,
      f.link,
      f.mediaId,
      id,
    );
    const now = f.team ? null : (f.year ?? row.season_year ?? year);
    if (now !== row.season_year) return now === null ? "It shows on every season now." : `Moved to the ${seasonLabel(now)} season.`;
  });
}

export async function deleteResource(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "resource", entityId: id }, async () => {
    await run("DELETE FROM resources WHERE id = ?", id);
    return "Resource deleted.";
  });
}
