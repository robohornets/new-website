import { EVENT_KEY_RE } from "@/lib/scouting";
import { getScoutingEvents, getTeamDetail, scoutingContext } from "@/lib/scouting-data";

// One team: TBA info and results, plus everything scouted about them this season.
export async function GET(request: Request, ctx: RouteContext<"/scouting/api/team/[number]">) {
  const team = Number((await ctx.params).number);
  const { env, open, year } = await scoutingContext();
  if (!open) return Response.json({ error: "Scouting is closed." }, { status: 403 });
  if (!Number.isInteger(team) || team < 1 || team > 99999) return Response.json({ error: "That isn't a team number." }, { status: 400 });
  const event = new URL(request.url).searchParams.get("event");
  const detail = await getTeamDetail(env, year, team, event && EVENT_KEY_RE.test(event) ? event : null, await getScoutingEvents(year));
  return Response.json(detail, { headers: { "cache-control": "no-store" } });
}
