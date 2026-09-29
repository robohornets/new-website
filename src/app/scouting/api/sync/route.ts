import { batch, first, parseJson, run } from "@/lib/db";
import { visitorIpHash } from "@/lib/ip";
import { cleanData, EVENT_KEY_RE, MATCH_KEY_RE, type ScoutingData } from "@/lib/scouting";
import { scoutingContext } from "@/lib/scouting-data";

// Saves what /scouting queued up, possibly hours later if the phone was
// offline. Anyone can add, edit or delete; the old version of anything
// changed goes to scouting_history first so an admin can put it back.
//
// POST { ops: Op[] }  →  { results: { ok, error? }[] }

type RobotOp = { op: "robot"; team: number; changes: Record<string, unknown>; scouter: string };
type ReportOp = { op: "report"; clientId: string; team: number; eventKey: string | null; matchKey: string | null; data: Record<string, unknown>; scouter: string };
type DeleteOp = { op: "delete"; clientId: string; scouter: string };
type Op = RobotOp | ReportOp | DeleteOp;

const MAX_OPS_PER_REQUEST = 50;
// Per network per hour. A whole scouting team shares one venue network.
const MAX_OPS_PER_HOUR = 2000;

type Row = { id: number; data: string; match_key: string | null; scouter: string; deleted_at: string | null };

class OpError extends Error {}

const name = (v: unknown) => String(v ?? "").trim().slice(0, 60) || "Anonymous";
const teamNumber = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 99999) throw new OpError("Bad team number.");
  return n;
};
const clientId = (v: unknown) => {
  const s = String(v ?? "");
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(s)) throw new OpError("Bad id.");
  return s;
};
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export async function POST(request: Request) {
  const { open, year, form } = await scoutingContext();
  if (!open) return Response.json({ error: "Scouting is closed." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { ops?: unknown } | null;
  const ops = Array.isArray(body?.ops) ? (body.ops as Op[]).slice(0, MAX_OPS_PER_REQUEST) : [];
  if (ops.length === 0) return Response.json({ results: [] });

  const ipHash = await visitorIpHash();
  const recent = await first<{ n: number | null }>(
    "SELECT SUM(ops) AS n FROM scouting_writes WHERE ip_hash = ? AND at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')",
    ipHash,
  );
  if ((recent?.n ?? 0) + ops.length > MAX_OPS_PER_HOUR) {
    return Response.json({ error: "Too many changes from this network. Try again in a little while." }, { status: 429 });
  }
  await batch([
    ["INSERT INTO scouting_writes (ip_hash, ops) VALUES (?, ?)", ipHash, ops.length],
    ["DELETE FROM scouting_writes WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 day')"],
  ]);

  const results: { ok: boolean; error?: string }[] = [];
  for (const op of ops) {
    try {
      if (op.op === "robot") await saveRobot(year, form.robot, op);
      else if (op.op === "report") await saveReport(year, form.match, op);
      else if (op.op === "delete") await deleteEntry(year, op);
      else throw new OpError("Unknown change.");
      results.push({ ok: true });
    } catch (e) {
      if (!(e instanceof OpError)) console.error("scouting sync failed", e);
      results.push({ ok: false, error: e instanceof OpError ? e.message : "Couldn't save that." });
    }
  }
  return Response.json({ results });
}

function history(row: Row, action: string, changedBy: string): [string, ...(string | number | null)[]] {
  return [
    "INSERT INTO scouting_history (entry_id, action, data, match_key, scouter, changed_by) VALUES (?, ?, ?, ?, ?, ?)",
    row.id,
    action,
    row.data,
    row.match_key,
    row.scouter,
    changedBy,
  ];
}

/**
 * The robot sheet is shared, so the phone sends only the questions it
 * changed. Two people filling in different questions offline both keep
 * their answers.
 */
async function saveRobot(year: number, fields: Parameters<typeof cleanData>[0], op: RobotOp) {
  const team = teamNumber(op.team);
  const scouter = name(op.scouter);
  const row = await first<Row>(
    "SELECT id, data, match_key, scouter, deleted_at FROM scouting_entries WHERE season_year = ? AND team_number = ? AND kind = 'robot'",
    year,
    team,
  );
  const previous = row && !row.deleted_at ? parseJson<ScoutingData>(row.data, {}) : {};
  const merged: Record<string, unknown> = { ...previous };
  for (const [k, v] of Object.entries(op.changes ?? {})) {
    if (v === null) delete merged[k];
    else merged[k] = v;
  }
  const data = JSON.stringify(cleanData(fields, merged, previous));
  if (row) {
    await batch([
      history(row, "edit", scouter),
      ["UPDATE scouting_entries SET data = ?, scouter = ?, deleted_at = NULL, updated_at = ? WHERE id = ?", data, scouter, now(), row.id],
    ]);
  } else {
    await run(
      "INSERT INTO scouting_entries (season_year, team_number, kind, data, scouter, client_id) VALUES (?, ?, 'robot', ?, ?, ?)",
      year,
      team,
      data,
      scouter,
      crypto.randomUUID(),
    );
  }
}

async function saveReport(year: number, fields: Parameters<typeof cleanData>[0], op: ReportOp) {
  const id = clientId(op.clientId);
  const team = teamNumber(op.team);
  const scouter = name(op.scouter);
  const eventKey = op.eventKey && EVENT_KEY_RE.test(op.eventKey) ? op.eventKey : null;
  const matchKey = op.matchKey && MATCH_KEY_RE.test(op.matchKey) ? op.matchKey : null;
  const row = await first<Row & { team_number: number }>(
    "SELECT id, data, match_key, scouter, deleted_at, team_number FROM scouting_entries WHERE client_id = ? AND kind = 'report'",
    id,
  );
  const previous = row ? parseJson<ScoutingData>(row.data, {}) : {};
  const data = JSON.stringify(cleanData(fields, op.data, previous));
  if (row) {
    await batch([
      history(row, "edit", scouter),
      [
        "UPDATE scouting_entries SET team_number = ?, event_key = ?, match_key = ?, data = ?, scouter = ?, updated_at = ? WHERE id = ?",
        team,
        eventKey,
        matchKey,
        data,
        scouter,
        now(),
        row.id,
      ],
    ]);
  } else {
    await run(
      `INSERT INTO scouting_entries (season_year, team_number, kind, event_key, match_key, data, scouter, client_id)
       VALUES (?, ?, 'report', ?, ?, ?, ?, ?)`,
      year,
      team,
      eventKey,
      matchKey,
      data,
      scouter,
      id,
    );
  }
}

async function deleteEntry(year: number, op: DeleteOp) {
  const id = clientId(op.clientId);
  const row = await first<Row>(
    "SELECT id, data, match_key, scouter, deleted_at FROM scouting_entries WHERE client_id = ? AND season_year = ?",
    id,
    year,
  );
  if (!row || row.deleted_at) return;
  await batch([history(row, "delete", name(op.scouter)), ["UPDATE scouting_entries SET deleted_at = ? WHERE id = ?", now(), row.id]]);
}
