"use server";

import { adminAction, bool, FormError, type ActionState } from "@/lib/admin";
import { batch, first, parseJson, run } from "@/lib/db";
import { cleanForm } from "@/lib/scouting";
import { seasonLabel } from "@/lib/format";

export async function saveScoutingForm(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "scouting_form", entityId: year }, async () => {
    const form = cleanForm(parseJson(String(fd.get("fields") ?? ""), null));
    await run(
      `INSERT INTO scouting_forms (season_year, fields) VALUES (?, ?)
       ON CONFLICT(season_year) DO UPDATE SET fields = excluded.fields, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
      year,
      JSON.stringify(form),
    );
  });
}

type Entry = { id: number; data: string; match_key: string | null; scouter: string; deleted_at: string | null };

const snapshot = (e: Entry, action: string, by: string): [string, ...(string | number | null)[]] => [
  "INSERT INTO scouting_history (entry_id, action, data, match_key, scouter, changed_by) VALUES (?, ?, ?, ?, ?, ?)",
  e.id,
  action,
  e.data,
  e.match_key,
  e.scouter,
  by,
];

async function entry(id: number) {
  const e = await first<Entry>("SELECT id, data, match_key, scouter, deleted_at FROM scouting_entries WHERE id = ?", id);
  if (!e) throw new FormError("That entry doesn't exist anymore.");
  return e;
}

export async function deleteScoutingEntry(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "scouting_entry", entityId: id }, async (user) => {
    const e = await entry(id);
    if (e.deleted_at) return "Already deleted.";
    await batch([snapshot(e, "delete", user.email), ["UPDATE scouting_entries SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?", id]]);
    return "Deleted. You can restore it from Deleted below.";
  });
}

/** Brings back a deleted entry as it was. */
export async function restoreScoutingEntry(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "restore", entity: "scouting_entry", entityId: id }, async () => {
    await run("UPDATE scouting_entries SET deleted_at = NULL WHERE id = ?", id);
    return "Restored.";
  });
}

/** Puts an older version back. The version being replaced goes into the history too. */
export async function restoreScoutingVersion(historyId: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "restore_version", entity: "scouting_history", entityId: historyId }, async (user) => {
    const version = await first<{ entry_id: number; data: string; match_key: string | null; scouter: string }>(
      "SELECT entry_id, data, match_key, scouter FROM scouting_history WHERE id = ?",
      historyId,
    );
    if (!version) throw new FormError("That version doesn't exist anymore.");
    const current = await entry(version.entry_id);
    await batch([
      snapshot(current, "restore", user.email),
      [
        `UPDATE scouting_entries SET data = ?, match_key = ?, scouter = ?, deleted_at = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
        version.data,
        version.match_key,
        version.scouter,
        version.entry_id,
      ],
    ]);
    return "That version is back.";
  });
}

/** Whether this season's scouting shows on its public season page (Scouting tab). */
export async function setScoutingPublished(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "publish", entity: "scouting", entityId: year }, async () => {
    const published = bool(fd, "published");
    await run(
      `INSERT INTO scouting_forms (season_year, published) VALUES (?, ?)
       ON CONFLICT(season_year) DO UPDATE SET published = excluded.published`,
      year,
      published,
    );
    return published ? `${seasonLabel(year)} scouting is on the season page.` : `${seasonLabel(year)} scouting is off the season page.`;
  });
}
