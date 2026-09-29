// Pulls 1209's events, results, matches and awards from The Blue Alliance into
// D1. Admin-overridden fields are never overwritten (see fields.ts).
//
// Plain Worker code: used by admin Server Actions and by the cron handler.

import { tbaGet, teamKey, type TbaAward, type TbaEnv, type TbaEvent, type TbaMatch, type TbaTeamEventStatus } from "./client";
import { parseOverrides, parseTba } from "./fields";
import { awardFields, eventFields, FRC_GAMES, matchFields, statusFields } from "./map";

type Value = string | number | null;
type Stmt = D1PreparedStatement;

export type SyncSummary = {
  eventsAdded: number;
  eventsUpdated: number;
  matchesUpdated: number;
  unchanged: number;
  errors: string[];
};

const emptySummary = (): SyncSummary => ({ eventsAdded: 0, eventsUpdated: 0, matchesUpdated: 0, unchanged: 0, errors: [] });

type Opts = { force?: boolean };

/**
 * Builds the UPDATE for a TBA-backed row: remembers the new TBA values and
 * copies them into every column the admin hasn't overridden.
 */
function applyTba(
  db: D1Database,
  table: "events" | "matches",
  row: { id: number; tba: string | null; overrides: string | null },
  values: Record<string, Value>,
  always: Record<string, Value> = {},
): Stmt {
  const overrides = new Set(parseOverrides(row.overrides));
  const tba = { ...parseTba(row.tba), ...values };
  const sets: [string, Value][] = [["tba", JSON.stringify(tba)], ...Object.entries(always)];
  for (const [col, v] of Object.entries(values)) if (!overrides.has(col)) sets.push([col, v]);
  return db
    .prepare(`UPDATE ${table} SET ${sets.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .bind(...sets.map(([, v]) => v), row.id);
}

async function ensureSeason(db: D1Database, year: number) {
  const thisYear = new Date().getUTCFullYear();
  await db
    .prepare("INSERT OR IGNORE INTO seasons (year, game_name, status) VALUES (?, ?, ?)")
    .bind(year, (FRC_GAMES[year] ?? "").toUpperCase(), year < thisYear ? "offseason" : "pre_kickoff")
    .run();
}

type EventRow = { id: number; tba_key: string | null; season_year: number; tba: string | null; overrides: string | null };

/** Adds or updates one event from TBA's event record. Returns its row. */
async function upsertEvent(db: D1Database, e: TbaEvent, summary: SyncSummary): Promise<EventRow> {
  const fields = eventFields(e);
  let row = await db
    .prepare("SELECT id, tba_key, season_year, tba, overrides FROM events WHERE tba_key = ?")
    .bind(e.key)
    .first<EventRow>();
  if (!row) {
    // An event an admin typed in by hand before syncing: link it instead of duplicating.
    row = await db
      .prepare(
        `SELECT id, tba_key, season_year, tba, overrides FROM events
         WHERE season_year = ? AND tba_key IS NULL AND (lower(name) = lower(?) OR (start_date IS NOT NULL AND start_date = ?))
         LIMIT 1`,
      )
      .bind(e.year, e.name, e.start_date)
      .first<EventRow>();
    if (row) {
      await db.prepare("UPDATE events SET tba_key = ? WHERE id = ?").bind(e.key, row.id).run();
      row.tba_key = e.key;
    }
  }
  if (!row) {
    await ensureSeason(db, e.year);
    row = await db
      .prepare(
        `INSERT INTO events (season_year, tba_key, name, kind, location, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, tba_key, season_year, tba, overrides`,
      )
      .bind(e.year, e.key, fields.name, fields.kind, fields.location, fields.start_date, fields.end_date)
      .first<EventRow>();
    if (!row) throw new Error(`Couldn't add ${e.key}`);
    summary.eventsAdded++;
  } else {
    summary.eventsUpdated++;
  }
  const { timezone, ...overridable } = fields;
  await applyTba(db, "events", row, overridable, { timezone }).run();
  row.tba = JSON.stringify({ ...parseTba(row.tba), ...overridable });
  return row;
}

/** Results, awards and matches for one event 1209 attended. */
export async function syncEventDetails(env: TbaEnv, eventKey: string, opts: Opts = {}, summary = emptySummary()) {
  const db = env.DB;
  const team = teamKey(env);
  const eventRow = await db
    .prepare("SELECT id, tba_key, season_year, tba, overrides FROM events WHERE tba_key = ?")
    .bind(eventKey)
    .first<EventRow>();
  if (!eventRow) throw new Error(`Event ${eventKey} isn't in the database yet.`);

  const [status, awards, matches] = await Promise.all([
    tbaGet<TbaTeamEventStatus>(env, `/team/${team}/event/${eventKey}/status`, opts),
    tbaGet<TbaAward[]>(env, `/team/${team}/event/${eventKey}/awards`, opts),
    tbaGet<TbaMatch[]>(env, `/team/${team}/event/${eventKey}/matches`, opts),
  ]);

  const eventValues: Record<string, Value> = {};
  if (status.changed) Object.assign(eventValues, statusFields(status.data));
  if (awards.changed) Object.assign(eventValues, awardFields(awards.data));
  const statements: Stmt[] = [];
  if (Object.keys(eventValues).length) statements.push(applyTba(db, "events", eventRow, eventValues));
  else summary.unchanged++;

  if (matches.changed && matches.data) {
    const existing = await db
      .prepare("SELECT id, tba_key, tba, overrides FROM matches WHERE event_id = ? AND tba_key IS NOT NULL")
      .bind(eventRow.id)
      .all<{ id: number; tba_key: string; tba: string | null; overrides: string | null }>();
    const byKey = new Map(existing.results.map((m) => [m.tba_key, m]));
    for (const m of matches.data) {
      const { structural, tba } = matchFields(m, team);
      const row = byKey.get(m.key);
      if (row) {
        statements.push(applyTba(db, "matches", row, tba, structural));
      } else {
        statements.push(
          db
            .prepare(
              `INSERT INTO matches (event_id, tba_key, comp_level, set_number, match_number, time, our_alliance,
                 red_teams, blue_teams, red_score, blue_score, result, video_url, tba)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              eventRow.id,
              m.key,
              structural.comp_level,
              structural.set_number,
              structural.match_number,
              structural.time,
              structural.our_alliance,
              tba.red_teams,
              tba.blue_teams,
              tba.red_score,
              tba.blue_score,
              tba.result,
              tba.video_url,
              JSON.stringify(tba),
            ),
        );
      }
      summary.matchesUpdated++;
    }
  }
  statements.push(
    db.prepare("UPDATE events SET tba_synced_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(eventRow.id),
  );
  await db.batch(statements);
  return summary;
}

/**
 * Every event 1209 is registered for in `year`: adds new ones, refreshes the
 * rest, then (unless `listOnly`) pulls results and matches for each.
 */
export async function syncYear(env: TbaEnv, year: number, opts: Opts & { listOnly?: boolean } = {}) {
  const summary = emptySummary();
  const team = teamKey(env);
  const list = await tbaGet<TbaEvent[]>(env, `/team/${team}/events/${year}`, opts);
  let keys: string[];
  if (list.changed) {
    for (const e of list.data ?? []) {
      try {
        await upsertEvent(env.DB, e, summary);
      } catch (err) {
        summary.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    keys = (list.data ?? []).map((e) => e.key);
  } else {
    summary.unchanged++;
    const rows = await env.DB.prepare("SELECT tba_key FROM events WHERE season_year = ? AND tba_key IS NOT NULL")
      .bind(year)
      .all<{ tba_key: string }>();
    keys = rows.results.map((r) => r.tba_key);
  }
  if (!opts.listOnly) {
    for (const key of keys) {
      try {
        await syncEventDetails(env, key, opts, summary);
      } catch (err) {
        summary.errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return summary;
}

/** Years 1209 has competed, according to TBA. */
export async function yearsParticipated(env: TbaEnv): Promise<number[]> {
  const res = await tbaGet<number[]>(env, `/team/${teamKey(env)}/years_participated`, { force: true });
  return res.changed ? (res.data ?? []).sort((a, b) => b - a) : [];
}

export async function saveSyncStatus(env: TbaEnv, trigger: string, summary: SyncSummary | null, error?: string) {
  const value = {
    at: new Date().toISOString(),
    trigger,
    ok: !error && (summary?.errors.length ?? 0) === 0,
    message: error ?? describe(summary),
    errors: summary?.errors.slice(0, 5) ?? [],
  };
  await env.DB.prepare(
    `INSERT INTO site_settings (key, value) VALUES ('tba_status', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
  )
    .bind(JSON.stringify(value))
    .run();
}

export function describe(s: SyncSummary | null): string {
  if (!s) return "";
  const parts = [];
  if (s.eventsAdded) parts.push(`${s.eventsAdded} new event${s.eventsAdded === 1 ? "" : "s"}`);
  if (s.eventsUpdated) parts.push(`${s.eventsUpdated} event${s.eventsUpdated === 1 ? "" : "s"} checked`);
  if (s.matchesUpdated) parts.push(`${s.matchesUpdated} match${s.matchesUpdated === 1 ? "" : "es"} updated`);
  if (!parts.length) parts.push("everything was already up to date");
  if (s.errors.length) parts.push(`${s.errors.length} problem${s.errors.length === 1 ? "" : "s"}`);
  return parts.join(", ");
}

// ---- Scheduled sync ---------------------------------------------------------

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Runs from the cron trigger every 15 minutes. Kept small so it fits the
 * Workers Free plan (50 outside requests and 10 ms CPU per run):
 *   - during an event (the day before through the day after), refresh it;
 *   - once a day, refresh the event list and a few events that need it.
 */
export async function runScheduledSync(env: TbaEnv, now = Date.now(), maxEvents = 3) {
  const db = env.DB;
  const today = isoDay(now);
  const summary = emptySummary();

  const live = await db
    .prepare(
      `SELECT tba_key FROM events
       WHERE tba_key IS NOT NULL AND start_date IS NOT NULL
         AND date(start_date, '-1 day') <= ? AND date(COALESCE(end_date, start_date), '+1 day') >= ?
       ORDER BY start_date LIMIT ?`,
    )
    .bind(today, today, maxEvents)
    .all<{ tba_key: string }>();
  for (const e of live.results) {
    try {
      await syncEventDetails(env, e.tba_key, {}, summary);
    } catch (err) {
      summary.errors.push(`${e.tba_key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // The daily pass: the first run after 09:00 UTC (early morning in Tulsa).
  const status = await db.prepare("SELECT value FROM site_settings WHERE key = 'tba_daily'").first<{ value: string }>();
  const lastDaily = status ? JSON.parse(status.value) : null;
  const due = new Date(now).getUTCHours() >= 9 && lastDaily !== today;
  if (due) {
    const current = await db
      .prepare("SELECT year FROM seasons ORDER BY is_current DESC, year DESC LIMIT 1")
      .first<{ year: number }>();
    const year = current?.year ?? new Date(now).getUTCFullYear();
    const listed = await syncYear(env, year, { listOnly: true });
    summary.eventsAdded += listed.eventsAdded;
    summary.errors.push(...listed.errors);
    // Events that ended in the last two weeks or start in the next month,
    // not refreshed today: results can change after the fact (awards, videos).
    const stale = await db
      .prepare(
        `SELECT tba_key FROM events
         WHERE tba_key IS NOT NULL AND start_date IS NOT NULL
           AND date(COALESCE(end_date, start_date)) >= date(?, '-14 days') AND date(start_date) <= date(?, '+30 days')
           AND (tba_synced_at IS NULL OR date(tba_synced_at) < ?)
         ORDER BY start_date LIMIT ?`,
      )
      .bind(today, today, today, Math.max(0, maxEvents - live.results.length))
      .all<{ tba_key: string }>();
    for (const e of stale.results) {
      try {
        await syncEventDetails(env, e.tba_key, {}, summary);
      } catch (err) {
        summary.errors.push(`${e.tba_key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await db
      .prepare(
        `INSERT INTO site_settings (key, value) VALUES ('tba_daily', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(JSON.stringify(today))
      .run();
  }

  if (live.results.length || due) await saveSyncStatus(env, "automatic", summary);
  return { ran: live.results.length > 0 || due, summary };
}
