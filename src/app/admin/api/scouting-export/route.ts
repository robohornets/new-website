import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { all, parseJson } from "@/lib/db";
import { toCsv } from "@/lib/export";
import { matchKeyLabel, type ScoutingData } from "@/lib/scouting";
import { cachedNicknames, getScoutingForm } from "@/lib/scouting-data";

// GET /admin/api/scouting-export?season=2026&part=robot|match
// One row per robot sheet or match report, one column per question, ready for a spreadsheet.
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("season"));
  const part = url.searchParams.get("part") === "match" ? "match" : "robot";
  if (!Number.isInteger(year)) return Response.json({ error: "Pick a season." }, { status: 400 });

  const form = await getScoutingForm(year);
  const fields = form[part].filter((f) => f.type !== "section");
  const rows = await all<{ team_number: number; event_key: string | null; match_key: string | null; data: string; scouter: string; created_at: string; updated_at: string }>(
    `SELECT team_number, event_key, match_key, data, scouter, created_at, updated_at FROM scouting_entries
     WHERE season_year = ? AND kind = ? AND deleted_at IS NULL ORDER BY team_number, created_at`,
    year,
    part === "match" ? "report" : "robot",
  );
  const names = await cachedNicknames([...new Set(rows.map((r) => r.team_number))]);
  const out = rows.map((r) => {
    const data = parseJson<ScoutingData>(r.data, {});
    const row: Record<string, unknown> = { Team: r.team_number, Name: names.get(r.team_number) ?? "" };
    if (part === "match") {
      row.Event = r.event_key ?? "";
      row.Match = matchKeyLabel(r.match_key);
    }
    for (const f of fields) {
      const v = data[f.id];
      row[f.label] = Array.isArray(v) ? v.join("; ") : typeof v === "boolean" ? (v ? "Yes" : "No") : (v ?? "");
    }
    row["Scouted by"] = r.scouter;
    row["Last changed"] = r.updated_at;
    return row;
  });
  const file = `scouting-${year}-${part === "match" ? "match-reports" : "robots"}.csv`;
  return new Response(`﻿${toCsv(out)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}
