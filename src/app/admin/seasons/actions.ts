"use server";

import { redirect } from "next/navigation";
import {
  adminAction,
  bool,
  date,
  FormError,
  int,
  oneOf,
  optional,
  optionalInt,
  parseList,
  parseSpecs,
  str,
  url,
  type ActionState,
} from "@/lib/admin";
import { batch, first, run } from "@/lib/db";
import type { EventKind, RobotKind, SeasonStatus } from "@/lib/types";

const STATUSES: SeasonStatus[] = ["pre_kickoff", "build", "competition", "offseason"];
const ROBOT_KINDS: RobotKind[] = ["competition", "kitbot", "offseason", "prototype"];
const EVENT_KINDS: EventKind[] = ["regional", "district", "championship", "offseason", "outreach", "other"];

function yearFrom(fd: FormData) {
  const year = int(fd, "year", 0);
  if (year < 1992 || year > 2100) throw new FormError("Enter a season year like 2027.");
  return year;
}

// ---- Seasons ----------------------------------------------------------------

export async function createSeason(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let year = 0;
  const result = await adminAction({ action: "create", entity: "season", entityId: str(fd, "year") }, async () => {
    year = yearFrom(fd);
    if (await first("SELECT 1 FROM seasons WHERE year = ?", year)) throw new FormError(`There is already a ${year} season.`);

    const previous = await first<{ year: number }>(
      "SELECT year FROM seasons WHERE year < ? ORDER BY is_current DESC, year DESC LIMIT 1",
      year,
    );
    const makeCurrent = bool(fd, "make_current") === 1;

    const statements: [string, ...(string | number | null)[]][] = [];
    if (makeCurrent) statements.push(["UPDATE seasons SET is_current = 0 WHERE is_current = 1"]);
    statements.push([
      `INSERT INTO seasons (year, game_name, summary, status, kickoff_date, reveal_video_url, is_current)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      year,
      str(fd, "game_name", 120),
      str(fd, "summary", 4000),
      oneOf(fd, "status", STATUSES, "pre_kickoff"),
      date(fd, "kickoff_date"),
      url(fd, "reveal_video_url"),
      makeCurrent ? 1 : 0,
    ]);

    if (previous) {
      if (bool(fd, "carry_students")) {
        // Everyone who hasn't graduated before the new season.
        statements.push([
          `INSERT OR IGNORE INTO roster_entries (season_year, person_id, role, subteam, is_leadership, sort_order)
           SELECT ?, e.person_id, e.role, e.subteam, 0, e.sort_order
           FROM roster_entries e JOIN people p ON p.id = e.person_id
           WHERE e.season_year = ? AND p.kind = 'student'
             AND (p.graduation_year IS NULL OR p.graduation_year >= ?)`,
          year,
          previous.year,
          year,
        ]);
      }
      if (bool(fd, "carry_mentors")) {
        statements.push([
          `INSERT OR IGNORE INTO roster_entries (season_year, person_id, role, subteam, is_leadership, sort_order)
           SELECT ?, e.person_id, e.role, e.subteam, e.is_leadership, e.sort_order
           FROM roster_entries e JOIN people p ON p.id = e.person_id
           WHERE e.season_year = ? AND p.kind = 'mentor'`,
          year,
          previous.year,
        ]);
      }
      if (bool(fd, "carry_sponsors")) {
        statements.push([
          `INSERT OR IGNORE INTO sponsor_seasons (sponsor_id, season_year, tier_id, sort_order)
           SELECT sponsor_id, ?, tier_id, sort_order FROM sponsor_seasons WHERE season_year = ?`,
          year,
          previous.year,
        ]);
      }
    }
    await batch(statements);
    return `${year} season created.`;
  });
  if (result.ok) redirect(`/admin/seasons/${year}`);
  return result;
}

export async function updateSeason(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "season", entityId: year }, async () => {
    await run(
      `UPDATE seasons SET game_name = ?, summary = ?, status = ?, kickoff_date = ?, reveal_video_url = ?,
         hero_media_id = ?, notebook_media_id = ?, notebook_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE year = ?`,
      str(fd, "game_name", 120),
      str(fd, "summary", 4000),
      oneOf(fd, "status", STATUSES, "pre_kickoff"),
      date(fd, "kickoff_date"),
      url(fd, "reveal_video_url"),
      optionalInt(fd, "hero_media_id"),
      optionalInt(fd, "notebook_media_id"),
      url(fd, "notebook_url"),
      year,
    );
  });
}

export async function makeCurrentSeason(year: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "make_current", entity: "season", entityId: year }, async () => {
    await batch([
      ["UPDATE seasons SET is_current = 0 WHERE is_current = 1"],
      ["UPDATE seasons SET is_current = 1 WHERE year = ?", year],
    ]);
    return `${year} is now the current season.`;
  });
}

export async function deleteSeason(year: number, _prev: ActionState): Promise<ActionState> {
  const result = await adminAction({ action: "delete", entity: "season", entityId: year }, async () => {
    await run("DELETE FROM seasons WHERE year = ?", year);
  });
  if (result.ok) redirect("/admin/seasons");
  return result;
}

// ---- Robots -----------------------------------------------------------------

function robotFields(fd: FormData) {
  const name = str(fd, "name", 120);
  if (!name) throw new FormError("Give the robot a name.");
  return [
    name,
    oneOf(fd, "kind", ROBOT_KINDS, "competition"),
    str(fd, "description", 2000),
    JSON.stringify(parseSpecs(str(fd, "specs", 4000))),
    JSON.stringify(parseList(str(fd, "tags", 400))),
    url(fd, "code_url"),
    url(fd, "cad_url"),
    optionalInt(fd, "photo_media_id"),
    int(fd, "sort_order", 0),
  ] as const;
}

export async function createRobot(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "robot", entityId: year }, async () => {
    await run(
      `INSERT INTO robots (name, kind, description, specs, tags, code_url, cad_url, photo_media_id, sort_order, season_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...robotFields(fd),
      year,
    );
    return "Robot added.";
  });
}

export async function updateRobot(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "robot", entityId: id }, async () => {
    await run(
      `UPDATE robots SET name = ?, kind = ?, description = ?, specs = ?, tags = ?, code_url = ?, cad_url = ?,
         photo_media_id = ?, sort_order = ? WHERE id = ?`,
      ...robotFields(fd),
      id,
    );
  });
}

export async function deleteRobot(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "robot", entityId: id }, async () => {
    await run("DELETE FROM robots WHERE id = ?", id);
    return "Robot removed.";
  });
}

// ---- Events -----------------------------------------------------------------

// Editing, syncing and deleting events lives in ../events/actions.ts.

/** Adds an event by hand, for things The Blue Alliance doesn't list (scrimmages, demos). */
export async function createEvent(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "event", entityId: year }, async () => {
    const name = str(fd, "name", 160);
    if (!name) throw new FormError("Give the event a name.");
    const row = await first<{ id: number }>(
      `INSERT INTO events (name, kind, location, start_date, end_date, tba_key, season_year)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      name,
      oneOf(fd, "kind", EVENT_KINDS, "offseason"),
      str(fd, "location", 160),
      date(fd, "start_date"),
      date(fd, "end_date"),
      optional(fd, "tba_key", 40)?.toLowerCase() ?? null,
      year,
    );
    id = row?.id ?? 0;
  });
  if (result.ok && id) redirect(`/admin/events/${id}?created=1`);
  return result;
}
