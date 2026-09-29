import { cachedNicknames, getScoutingCounts, getScoutingEvents, scoutingContext } from "@/lib/scouting-data";

// Everything /scouting needs to start: whether it's open, the season's form,
// our events, and the teams already scouted this season.
export async function GET() {
  const { open, year, form } = await scoutingContext();
  if (!open) return Response.json({ open: false, year }, { headers: { "cache-control": "no-store" } });
  const [events, counts] = await Promise.all([getScoutingEvents(year), getScoutingCounts(year)]);
  const nicknames = await cachedNicknames([...counts.keys()]);
  const scouted = [...counts.entries()]
    .map(([number, c]) => ({ number, nickname: nicknames.get(number) ?? "", hasRobot: c.robot, reports: c.reports }))
    .sort((a, b) => a.number - b.number);
  return Response.json({ open: true, year, form, events, scouted }, { headers: { "cache-control": "no-store" } });
}
