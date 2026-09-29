"use server";

import { redirect } from "next/navigation";
import { adminAction, bool, FormError, int, oneOf, optionalInt, str, type ActionState } from "@/lib/admin";
import { first, run } from "@/lib/db";
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
      `INSERT INTO roster_entries (season_year, person_id, role, subteam, is_leadership, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      year,
      person.id,
      str(fd, "role", 80) || "Member",
      str(fd, "subteam", 80),
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
      `INSERT INTO roster_entries (season_year, person_id, role, subteam, is_leadership, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      year,
      personId,
      str(fd, "role", 80) || "Member",
      str(fd, "subteam", 80),
      bool(fd, "is_leadership"),
      int(fd, "sort_order", 0),
    );
    return "Added to the roster.";
  });
}

export async function updateRosterEntry(entryId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "roster_entry", entityId: entryId }, async () => {
    await run(
      "UPDATE roster_entries SET role = ?, subteam = ?, is_leadership = ?, sort_order = ? WHERE id = ?",
      str(fd, "role", 80) || "Member",
      str(fd, "subteam", 80),
      bool(fd, "is_leadership"),
      int(fd, "sort_order", 0),
      entryId,
    );
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
