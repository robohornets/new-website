import { EVENT_KEY_RE } from "@/lib/scouting";
import { getEventTeams, scoutingContext } from "@/lib/scouting-data";

// Every team at one event, with TBA rank/record/OPR and our scouting counts.
export async function GET(_request: Request, ctx: RouteContext<"/scouting/api/event/[key]">) {
  const { key } = await ctx.params;
  const { env, open, year } = await scoutingContext();
  if (!open) return Response.json({ error: "Scouting is closed." }, { status: 403 });
  if (!EVENT_KEY_RE.test(key)) return Response.json({ error: "That isn't an event key." }, { status: 400 });
  const teams = await getEventTeams(env, year, key);
  return Response.json({ key, teams }, { headers: { "cache-control": "no-store" } });
}
