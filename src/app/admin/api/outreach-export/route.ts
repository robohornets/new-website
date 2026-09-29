import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { toCsv } from "@/lib/export";
import { getOutreachLog, getOutreachPeople } from "@/lib/outreach";

// GET /admin/api/outreach-export?season=2026&part=people|log
// Totals per person, or one row per person per event.
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("season"));
  const part = url.searchParams.get("part") === "log" ? "log" : "people";
  if (!Number.isInteger(year)) return Response.json({ error: "Pick a season." }, { status: 400 });

  const who = (p: { kind: string; graduation_year: number | null }) => (p.kind === "mentor" ? "Mentor" : "Student");
  const rows =
    part === "log"
      ? (await getOutreachLog(year)).map((r) => ({
          Event: r.event,
          Date: r.start_date?.slice(0, 10) ?? "",
          "First name": r.first_name,
          "Last name": r.last_name,
          Role: who(r),
          "Class of": r.graduation_year ?? "",
          Hours: r.hours,
        }))
      : (await getOutreachPeople(year)).map((p) => ({
          "First name": p.first_name,
          "Last name": p.last_name,
          Role: who(p),
          "Class of": p.graduation_year ?? "",
          Events: p.events,
          Hours: p.hours,
        }));
  const file = `outreach-${year}-${part === "log" ? "log" : "hours-by-person"}.csv`;
  return new Response(`﻿${toCsv(rows)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}
