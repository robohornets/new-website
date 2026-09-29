"use server";

import { redirect } from "next/navigation";
import { adminAction, bool, date, FormError, int, oneOf, optionalInt, str, url, type ActionState } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { getEnv } from "@/lib/cf";
import { batch, first, run } from "@/lib/db";
import { tbaConfigured } from "@/lib/tba/client";
import { EVENT_TBA_FIELDS, MATCH_TBA_FIELDS, nextOverrides, parseOverrides, parseTba } from "@/lib/tba/fields";
import { saveSyncStatus, syncEventDetails, syncYear, yearsParticipated, describe } from "@/lib/tba/sync";
import type { EventKind } from "@/lib/types";

type Value = string | number | null;
const EVENT_KINDS: EventKind[] = ["regional", "district", "championship", "offseason", "outreach", "other"];

async function tbaEnv() {
  const env = await getEnv();
  if (!tbaConfigured(env)) {
    throw new FormError("The Blue Alliance isn't connected yet. Add the TBA API key first (see the README).");
  }
  return env;
}

// ---- Syncing ----------------------------------------------------------------

export async function syncSeasonFromTba(year: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "tba_sync", entity: "season", entityId: year }, async () => {
    const env = await tbaEnv();
    const summary = await syncYear(env, year, { force: true });
    await saveSyncStatus(env, "manual", summary);
    if (summary.errors.length) throw new FormError(`Synced with problems: ${summary.errors.slice(0, 3).join("; ")}`);
    return `Synced ${year} from The Blue Alliance: ${describe(summary)}.`;
  });
}

export async function syncEventFromTba(eventId: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "tba_sync", entity: "event", entityId: eventId }, async () => {
    const env = await tbaEnv();
    const ev = await first<{ tba_key: string | null; season_year: number }>(
      "SELECT tba_key, season_year FROM events WHERE id = ?",
      eventId,
    );
    if (!ev?.tba_key) throw new FormError("This event has no Blue Alliance key, so there's nothing to sync.");
    // Refresh the event's own details (name, dates, webcast) along with results.
    const summary = await syncYear(env, ev.season_year, { force: true, listOnly: true });
    await syncEventDetails(env, ev.tba_key, { force: true }, summary);
    await saveSyncStatus(env, "manual", summary);
    return `Synced from The Blue Alliance: ${describe(summary)}.`;
  });
}

/** Years to import, newest first. The client calls importYearFromTba once per year. */
export async function listTbaYears(): Promise<{ years: number[]; error?: string }> {
  await requireAdmin();
  try {
    return { years: await yearsParticipated(await tbaEnv()) };
  } catch (e) {
    return { years: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function importYearFromTba(year: number): Promise<{ ok: boolean; message: string }> {
  const res = await adminAction({ action: "tba_import", entity: "season", entityId: year }, async () => {
    const env = await tbaEnv();
    const summary = await syncYear(env, year, { force: true });
    if (summary.errors.length) throw new FormError(summary.errors.slice(0, 2).join("; "));
    return describe(summary);
  });
  return { ok: res.ok, message: res.ok ? (res.message ?? "") : (res.error ?? "Failed") };
}

// ---- Event edits (with per-field overrides) -----------------------------------

function eventValue(fd: FormData, name: string): Value {
  switch (name) {
    case "start_date":
    case "end_date":
      return date(fd, name);
    case "website":
    case "webcast_url":
      return url(fd, name);
    case "kind":
      return oneOf(fd, name, EVENT_KINDS, "other");
    default:
      return str(fd, name, name === "awards" ? 600 : 200);
  }
}

export async function updateEvent(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "event", entityId: id }, async () => {
    const row = await first<{ tba: string | null; overrides: string }>("SELECT tba, overrides FROM events WHERE id = ?", id);
    if (!row) throw new FormError("That event no longer exists.");
    const names = EVENT_TBA_FIELDS.map((f) => f.name);
    const submitted: Record<string, Value> = {};
    const shown: Record<string, Value> = {};
    for (const n of names) {
      submitted[n] = eventValue(fd, n);
      shown[n] = str(fd, `shown_${n}`, 600) || null;
    }
    if (!submitted.name) throw new FormError("The event needs a name.");
    const tba = parseTba(row.tba);
    const overrides = row.tba ? nextOverrides(names, parseOverrides(row.overrides), tba, shown, submitted) : [];

    const tbaKey = str(fd, "tba_key", 40).toLowerCase() || null;
    if (tbaKey && !/^\d{4}[a-z0-9]+$/.test(tbaKey)) throw new FormError("A Blue Alliance key looks like 2026okok.");
    const cols: [string, Value][] = [
      ...names.map((n) => [n, n === "rank" || n === "record" || n === "alliance" || n === "playoff_result" || n === "awards" ? (submitted[n] ?? "") : submitted[n]] as [string, Value]),
      ["recap", str(fd, "recap", 4000)],
      ["highlight_video_url", url(fd, "highlight_video_url")],
      ["album_id", optionalInt(fd, "album_id")],
      ["hidden", bool(fd, "hidden")],
      ["notes", str(fd, "notes", 2000)],
      ["tba_key", tbaKey],
      ["overrides", JSON.stringify(overrides)],
    ];
    await run(`UPDATE events SET ${cols.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`, ...cols.map(([, v]) => v), id);
    return overrides.length ? `Saved. ${overrides.length} field${overrides.length === 1 ? "" : "s"} now use your value instead of TBA's.` : "Saved.";
  });
}

async function resetFields(table: "events" | "matches", id: number, fields: string[] | "all") {
  await requireAdmin();
  const row = await first<{ tba: string | null; overrides: string }>(`SELECT tba, overrides FROM ${table} WHERE id = ?`, id);
  if (!row?.tba) return;
  const tba = parseTba(row.tba);
  const current = parseOverrides(row.overrides);
  const reset = fields === "all" ? current : current.filter((f) => fields.includes(f));
  const keep = current.filter((f) => !reset.includes(f));
  const sets: [string, Value][] = [["overrides", JSON.stringify(keep)], ...reset.map((f) => [f, tba[f] ?? (table === "events" ? "" : null)] as [string, Value])];
  await run(`UPDATE ${table} SET ${sets.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`, ...sets.map(([, v]) => v), id);
}

/** Used as a button's formAction next to an edited field. */
export async function resetEventField(id: number, field: string): Promise<void> {
  await adminAction({ action: "reset_to_tba", entity: "event", entityId: id }, async () => resetFields("events", id, [field]));
}

export async function resetAllEventFields(id: number): Promise<void> {
  await adminAction({ action: "reset_to_tba", entity: "event", entityId: id }, async () => resetFields("events", id, "all"));
}

export async function deleteEvent(id: number, _prev: ActionState): Promise<ActionState> {
  let year = 0;
  const result = await adminAction({ action: "delete", entity: "event", entityId: id }, async () => {
    const ev = await first<{ season_year: number }>("SELECT season_year FROM events WHERE id = ?", id);
    year = ev?.season_year ?? 0;
    await run("DELETE FROM events WHERE id = ?", id);
  });
  if (result.ok) redirect(year ? `/admin/seasons/${year}#events` : "/admin/seasons");
  return result;
}

// ---- Matches ----------------------------------------------------------------

function matchValue(fd: FormData, name: string): Value {
  if (name === "red_score" || name === "blue_score") return optionalInt(fd, name);
  if (name === "video_url") return url(fd, name);
  if (name === "result") return oneOf(fd, name, ["win", "loss", "tie", ""] as const, "");
  // Team lists: keep just numbers, comma separated.
  return str(fd, name, 100)
    .split(/[\s,]+/)
    .map((t) => t.replace(/^frc/i, ""))
    .filter((t) => /^\d+[a-z]?$/i.test(t))
    .join(", ");
}

export async function updateMatch(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "match", entityId: id }, async () => {
    const row = await first<{ tba: string | null; overrides: string }>("SELECT tba, overrides FROM matches WHERE id = ?", id);
    if (!row) throw new FormError("That match no longer exists.");
    const names = MATCH_TBA_FIELDS.map((f) => f.name);
    const submitted: Record<string, Value> = {};
    const shown: Record<string, Value> = {};
    for (const n of names) {
      submitted[n] = matchValue(fd, n);
      const raw = str(fd, `shown_${n}`, 200);
      shown[n] = raw === "" ? null : n.endsWith("_score") ? Number(raw) : raw;
    }
    const overrides = row.tba ? nextOverrides(names, parseOverrides(row.overrides), parseTba(row.tba), shown, submitted) : [];
    const cols: [string, Value][] = [
      ...names.map((n) => [n, n === "result" || n.endsWith("_teams") ? (submitted[n] ?? "") : submitted[n]] as [string, Value]),
      ["hidden", bool(fd, "hidden")],
      ["overrides", JSON.stringify(overrides)],
    ];
    if (!row.tba) {
      // Hand-entered matches can also change their number and side.
      cols.push(
        ["comp_level", oneOf(fd, "comp_level", ["qm", "ef", "qf", "sf", "f"] as const, "qm")],
        ["set_number", int(fd, "set_number", 1)],
        ["match_number", int(fd, "match_number", 1)],
        ["our_alliance", oneOf(fd, "our_alliance", ["red", "blue"] as const, "red")],
      );
    }
    await run(`UPDATE matches SET ${cols.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`, ...cols.map(([, v]) => v), id);
  });
}

export async function resetMatchField(id: number, field: string): Promise<void> {
  await adminAction({ action: "reset_to_tba", entity: "match", entityId: id }, async () => resetFields("matches", id, [field]));
}

export async function createMatch(eventId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "match", entityId: eventId }, async () => {
    const values = Object.fromEntries(MATCH_TBA_FIELDS.map((f) => [f.name, matchValue(fd, f.name)]));
    await run(
      `INSERT INTO matches (event_id, comp_level, set_number, match_number, our_alliance, red_teams, blue_teams,
         red_score, blue_score, result, video_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      eventId,
      oneOf(fd, "comp_level", ["qm", "ef", "qf", "sf", "f"] as const, "qm"),
      int(fd, "set_number", 1),
      int(fd, "match_number", 1),
      oneOf(fd, "our_alliance", ["red", "blue"] as const, "red"),
      values.red_teams ?? "",
      values.blue_teams ?? "",
      values.red_score,
      values.blue_score,
      values.result ?? "",
      values.video_url,
    );
    return "Match added.";
  });
}

export async function deleteMatch(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "match", entityId: id }, async () => {
    const row = await first<{ tba_key: string | null }>("SELECT tba_key FROM matches WHERE id = ?", id);
    if (row?.tba_key) throw new FormError("Matches from The Blue Alliance come back on the next sync. Tick “Hide from site” instead.");
    await run("DELETE FROM matches WHERE id = ?", id);
    return "Match deleted.";
  });
}

export async function setMatchesHidden(eventId: number, hidden: boolean, _prev: ActionState): Promise<ActionState> {
  return adminAction(null, async () => {
    await batch([["UPDATE matches SET hidden = ? WHERE event_id = ?", hidden ? 1 : 0, eventId]]);
    return hidden ? "All matches hidden." : "All matches shown.";
  });
}
