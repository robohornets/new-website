"use server";

import { redirect } from "next/navigation";
import { adminAction, bool, FormError, int, oneOf, optionalInt, str, type ActionState } from "@/lib/admin";
import { batch, first, run } from "@/lib/db";
import type { PersonKind } from "@/lib/types";

const KINDS: PersonKind[] = ["student", "mentor"];

function personFields(fd: FormData) {
  const first_name = str(fd, "first_name", 80);
  if (!first_name) throw new FormError("First name is required.");
  return [
    first_name,
    str(fd, "last_name", 80),
    oneOf(fd, "kind", KINDS, "student"),
    str(fd, "bio", 1000),
    optionalInt(fd, "photo_media_id"),
    bool(fd, "show_photo"),
    optionalInt(fd, "graduation_year"),
  ] as const;
}

/** Adds a brand-new person and puts them on the given season's roster. */
export async function addNewPerson(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "person", entityId: year }, async () => {
    const person = await first<{ id: number }>(
      `INSERT INTO people (first_name, last_name, kind, bio, photo_media_id, show_photo, graduation_year)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ...personFields(fd),
    );
    if (!person) throw new Error("insert failed");
    await run(
      `INSERT INTO roster_entries (season_year, person_id, role, subteam_id, is_leadership, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      year,
      person.id,
      str(fd, "role", 80) || "Member",
      optionalInt(fd, "subteam_id"),
      bool(fd, "is_leadership"),
      int(fd, "sort_order", 0),
    );
    return `${str(fd, "first_name")} added.`;
  });
}

/** Puts someone from an earlier season on this season's roster. */
export async function addExistingPerson(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "add", entity: "roster_entry", entityId: year }, async () => {
    const personId = int(fd, "person_id", 0);
    if (!personId) throw new FormError("Choose someone to add.");
    await run(
      `INSERT INTO roster_entries (season_year, person_id, role, subteam_id, is_leadership, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      year,
      personId,
      str(fd, "role", 80) || "Member",
      optionalInt(fd, "subteam_id"),
      bool(fd, "is_leadership"),
      int(fd, "sort_order", 0),
    );
    return "Added to the roster.";
  });
}

/**
 * One row of the roster: this season's role and subteams, plus the person's
 * graduation year and photo (those belong to the person, not the season).
 */
export async function updateRosterRow(entryId: number, personId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "roster_entry", entityId: entryId }, async () => {
    const main = optionalInt(fd, "subteam_id");
    const extras = [...new Set(fd.getAll("extra_subteam").map((v) => Number(v)))].filter((n) => Number.isInteger(n) && n > 0 && n !== main);
    await batch([
      [
        "UPDATE roster_entries SET role = ?, subteam_id = ?, is_leadership = ?, sort_order = ? WHERE id = ?",
        str(fd, "role", 80) || "Member",
        main,
        bool(fd, "is_leadership"),
        int(fd, "sort_order", 0),
        entryId,
      ],
      ["DELETE FROM roster_extra_subteams WHERE entry_id = ?", entryId],
      ...extras.map((id): [string, number, number] => ["INSERT INTO roster_extra_subteams (entry_id, subteam_id) VALUES (?, ?)", entryId, id]),
      [
        "UPDATE people SET graduation_year = ?, photo_media_id = ?, show_photo = ? WHERE id = ?",
        optionalInt(fd, "graduation_year"),
        optionalInt(fd, "photo_media_id"),
        bool(fd, "show_photo"),
        personId,
      ],
    ]);
  });
}

// ---- Subteams ---------------------------------------------------------------

export async function createSubteam(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "subteam" }, async () => {
    const name = str(fd, "name", 60);
    if (!name) throw new FormError("Give the subteam a name.");
    await run(
      "INSERT INTO subteams (name, private, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM subteams))",
      name,
      bool(fd, "private"),
    );
    return `${name} added.`;
  });
}

/** Saves every subteam's name, private flag and order at once. */
export async function saveSubteams(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "subteams" }, async () => {
    const ids = str(fd, "ids", 2000)
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    const statements: [string, ...(string | number)[]][] = [];
    for (const id of ids) {
      const name = str(fd, `name_${id}`, 60);
      if (!name) throw new FormError("Every subteam needs a name. To get rid of one, click Delete next to it.");
      statements.push(["UPDATE subteams SET name = ?, private = ?, sort_order = ? WHERE id = ?", name, bool(fd, `private_${id}`), int(fd, `order_${id}`, 0), id]);
    }
    if (statements.length) await batch(statements);
  });
}

/** Run from a Delete button inside the subteams form. People on it are kept, with no subteam. */
export async function deleteSubteam(id: number): Promise<void> {
  await adminAction({ action: "delete", entity: "subteam", entityId: id }, async () => {
    await run("DELETE FROM subteams WHERE id = ?", id);
  });
}

export async function removeRosterEntry(entryId: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "roster_entry", entityId: entryId }, async () => {
    await run("DELETE FROM roster_entries WHERE id = ?", entryId);
    return "Removed from this season.";
  });
}

export async function updatePerson(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "person", entityId: id }, async () => {
    await run(
      `UPDATE people SET first_name = ?, last_name = ?, kind = ?, bio = ?, photo_media_id = ?, show_photo = ?,
         graduation_year = ? WHERE id = ?`,
      ...personFields(fd),
      id,
    );
  });
}

export async function deletePerson(id: number, _prev: ActionState): Promise<ActionState> {
  const result = await adminAction({ action: "delete", entity: "person", entityId: id }, async () => {
    await run("DELETE FROM people WHERE id = ?", id);
  });
  if (result.ok) redirect("/admin/roster");
  return result;
}
