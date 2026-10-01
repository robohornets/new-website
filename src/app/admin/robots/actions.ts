"use server";

import { redirect } from "next/navigation";
import { adminAction, FormError, int, oneOf, optionalInt, parseList, parseSpecs, str, url, type ActionState } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { first, run } from "@/lib/db";
import { seasonLabel } from "@/lib/format";
import type { RobotKind } from "@/lib/types";

const ROBOT_KINDS: RobotKind[] = ["competition", "kitbot", "offseason", "prototype"];

/** Adds a robot to a season and opens its page, where the rest is filled in. */
export async function createRobot(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "robot", entityId: year }, async () => {
    const name = str(fd, "name", 120);
    if (!name) throw new FormError("Give the robot a name.");
    const row = await first<{ id: number }>(
      `INSERT INTO robots (season_year, name, kind, sort_order)
       VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM robots WHERE season_year = ?)) RETURNING id`,
      year,
      name,
      oneOf(fd, "kind", ROBOT_KINDS, "competition"),
      year,
    );
    id = row?.id ?? 0;
  });
  if (result.ok && id) redirect(`/admin/robots/${id}?created=1`);
  return result;
}

/** "26-27 robot: Roomba", the title of the album made for a robot's photos. */
function robotAlbumTitle(year: number, name: string) {
  return `${seasonLabel(year)} robot: ${name}`;
}

export async function updateRobot(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "robot", entityId: id }, async () => {
    const name = str(fd, "name", 120);
    if (!name) throw new FormError("Give the robot a name.");
    const before = await first<{ season_year: number; name: string; album_id: number | null }>("SELECT season_year, name, album_id FROM robots WHERE id = ?", id);
    if (!before) throw new FormError("That robot no longer exists.");
    const year = optionalInt(fd, "season_year") ?? before.season_year;
    if (year !== before.season_year && !(await first("SELECT 1 FROM seasons WHERE year = ?", year))) throw new FormError("Pick a season that exists.");
    const moved = year !== before.season_year;
    await run(
      `UPDATE robots SET season_year = ?, name = ?, kind = ?, description = ?, specs = ?, tags = ?, code_url = ?, cad_url = ?,
         sort_order = CASE WHEN ? THEN (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM robots WHERE season_year = ?) ELSE ? END
       WHERE id = ?`,
      year,
      name,
      oneOf(fd, "kind", ROBOT_KINDS, "competition"),
      str(fd, "description", 2000),
      JSON.stringify(parseSpecs(str(fd, "specs", 4000))),
      JSON.stringify(parseList(str(fd, "tags", 400))),
      url(fd, "code_url"),
      url(fd, "cad_url"),
      moved ? 1 : 0,
      year,
      int(fd, "sort_order", 0),
      id,
    );
    // The album made for this robot moves and is renamed with it (unless someone renamed it).
    if (before.album_id && (moved || name !== before.name)) {
      await run(
        `UPDATE albums SET season_year = ?, title = CASE WHEN title = ? THEN ? ELSE title END
         WHERE id = ? AND slug LIKE ?`,
        year,
        robotAlbumTitle(before.season_year, before.name),
        robotAlbumTitle(year, name),
        before.album_id,
        `%-robot-${id}`,
      );
    }
    if (moved) return `Moved to the ${seasonLabel(year)} season.`;
  });
}

/** Which album the robot's photos come from (any album, or none). */
export async function setRobotAlbum(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "robot", entityId: id }, async () => {
    const albumId = optionalInt(fd, "album_id");
    if (albumId) {
      if (!(await first("SELECT 1 FROM albums WHERE id = ?", albumId))) throw new FormError("That album no longer exists.");
    }
    await run("UPDATE robots SET album_id = ? WHERE id = ?", albumId, id);
    return albumId ? "The slideshow now uses that album." : "The robot no longer has photos.";
  });
}

/**
 * The album a robot's uploads go into, made the first time it's needed
 * ("26-27 robot: Roomba", shown in the Gallery too). The robot's old single
 * photo, if any, becomes its first photo.
 */
export async function ensureRobotAlbum(id: number): Promise<number> {
  const user = await requireAdmin();
  const robot = await first<{ season_year: number; name: string; album_id: number | null; photo_media_id: number | null }>(
    "SELECT season_year, name, album_id, photo_media_id FROM robots WHERE id = ?",
    id,
  );
  if (!robot) throw new Error("That robot no longer exists.");
  if (robot.album_id) return robot.album_id;

  const album = await first<{ id: number }>(
    `INSERT INTO albums (slug, title, description, season_year, published, sort_order)
     VALUES (?, ?, '', ?, 1, (SELECT COALESCE(MIN(sort_order), 1) - 1 FROM albums))
     ON CONFLICT(slug) DO UPDATE SET slug = excluded.slug
     RETURNING id`,
    `${robot.season_year}-robot-${id}`,
    robotAlbumTitle(robot.season_year, robot.name),
    robot.season_year,
  );
  if (!album) throw new Error("Couldn't make the robot's album.");
  await run("UPDATE robots SET album_id = ? WHERE id = ?", album.id, id);
  if (robot.photo_media_id) {
    await run("INSERT OR IGNORE INTO album_photos (album_id, media_id, sort_order) VALUES (?, ?, 0)", album.id, robot.photo_media_id);
  }
  await run("INSERT INTO audit_log (actor, action, entity, entity_id) VALUES (?, 'create', 'album', ?)", user.email, String(album.id));
  return album.id;
}

export async function deleteRobot(id: number, _prev: ActionState): Promise<ActionState> {
  let year = 0;
  const result = await adminAction({ action: "delete", entity: "robot", entityId: id }, async () => {
    const row = await first<{ season_year: number }>("SELECT season_year FROM robots WHERE id = ?", id);
    year = row?.season_year ?? 0;
    await run("DELETE FROM robots WHERE id = ?", id);
  });
  if (result.ok) redirect(year ? `/admin/seasons/${year}#robots` : "/admin/seasons");
  return result;
}
