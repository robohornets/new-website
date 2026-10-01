"use server";

import { redirect } from "next/navigation";
import { adminAction, date, FormError, optionalInt, str, type ActionState } from "@/lib/admin";
import { batch, first, run } from "@/lib/db";
import { seasonLabel } from "@/lib/format";

/** Hours as typed ("2", "1.5", "1:30"). Empty is null. */
function hours(fd: FormData, key: string, label: string): number | null {
  const raw = str(fd, key, 20);
  if (!raw) return null;
  const clock = /^(\d+):([0-5]\d)$/.exec(raw);
  const n = clock ? Number(clock[1]) + Number(clock[2]) / 60 : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 200) throw new FormError(`${label}: "${raw}" isn't a number of hours.`);
  return Math.round(n * 100) / 100;
}

function count(fd: FormData, key: string): number | null {
  const raw = str(fd, key, 20).replace(/[,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new FormError(`People reached should be a whole number, like 150.`);
  return n;
}

function eventFields(fd: FormData) {
  const name = str(fd, "name", 160);
  if (!name) throw new FormError("Give the event a name.");
  const start = date(fd, "start_date");
  const end = date(fd, "end_date");
  if (start && end && end < start) throw new FormError("The end date is before the start date.");
  return {
    name,
    start,
    end,
    location: str(fd, "location", 160),
    hours: hours(fd, "outreach_hours", "How long"),
    reached: count(fd, "people_reached"),
  };
}

export async function createOutreachEvent(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "event", entityId: year }, async () => {
    const f = eventFields(fd);
    const row = await first<{ id: number }>(
      `INSERT INTO events (season_year, name, kind, location, start_date, end_date, outreach_hours, people_reached)
       VALUES (?, ?, 'outreach', ?, ?, ?, ?, ?) RETURNING id`,
      year,
      f.name,
      f.location,
      f.start,
      f.end,
      f.hours,
      f.reached,
    );
    id = row?.id ?? 0;
  });
  if (result.ok && id) redirect(`/admin/outreach/${id}?created=1`);
  return result;
}

/** The event's details and who went, saved together from the save bar. */
export async function saveOutreachEvent(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "outreach", entityId: id }, async () => {
    const ev = await first<{ tba: string | null; tba_key: string | null; season_year: number }>(
      "SELECT tba, tba_key, season_year FROM events WHERE id = ? AND kind = 'outreach'",
      id,
    );
    if (!ev) throw new FormError("That outreach event no longer exists.");
    // Events from The Blue Alliance stay in their key's season.
    const year = ev.tba_key ? ev.season_year : (optionalInt(fd, "season_year") ?? ev.season_year);
    if (year !== ev.season_year && !(await first("SELECT 1 FROM seasons WHERE year = ?", year))) throw new FormError("Pick a season that exists.");

    const went = [...new Set(fd.getAll("went").map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const statements: [string, ...(string | number | null)[]][] = [];
    // Events from The Blue Alliance keep TBA's name and dates (edit those on the event's page).
    if (!ev.tba) {
      const f = eventFields(fd);
      statements.push([
        "UPDATE events SET season_year = ?, name = ?, start_date = ?, end_date = ?, location = ?, outreach_hours = ?, people_reached = ?, recap = ? WHERE id = ?",
        year,
        f.name,
        f.start,
        f.end,
        f.location,
        f.hours,
        f.reached,
        str(fd, "recap", 4000),
        id,
      ]);
    } else {
      statements.push([
        "UPDATE events SET outreach_hours = ?, people_reached = ?, recap = ? WHERE id = ?",
        hours(fd, "outreach_hours", "How long"),
        count(fd, "people_reached"),
        str(fd, "recap", 4000),
        id,
      ]);
    }
    statements.push(["DELETE FROM outreach_attendance WHERE event_id = ?", id]);
    for (const person of went) {
      // Blank means the whole event.
      statements.push([
        "INSERT INTO outreach_attendance (event_id, person_id, hours) SELECT ?, id, ? FROM people WHERE id = ?",
        id,
        hours(fd, `hours_${person}`, "Hours"),
        person,
      ]);
    }
    await batch(statements);
    if (year !== ev.season_year) return `Moved to the ${seasonLabel(year)} season. ${went.length} ${went.length === 1 ? "person" : "people"} logged.`;
    return `Saved. ${went.length} ${went.length === 1 ? "person" : "people"} logged.`;
  });
}

export async function deleteOutreachEvent(id: number, _prev: ActionState): Promise<ActionState> {
  let year = 0;
  const result = await adminAction({ action: "delete", entity: "event", entityId: id }, async () => {
    const ev = await first<{ season_year: number; tba: string | null }>("SELECT season_year, tba FROM events WHERE id = ?", id);
    if (!ev) return;
    if (ev.tba) throw new FormError("This event comes from The Blue Alliance and would come back on the next sync. Hide it on its event page instead.");
    year = ev.season_year;
    await run("DELETE FROM events WHERE id = ?", id);
  });
  if (result.ok) redirect(year ? `/admin/outreach?season=${year}` : "/admin/outreach");
  return result;
}
