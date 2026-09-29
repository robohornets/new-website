import { getLiveMatches } from "@/lib/live-match";

// GET /api/live-match: the homepage card polls this once a minute while we're
// at a competition. An empty list means no competition today (the card hides).
export async function GET() {
  return Response.json(await getLiveMatches(), { headers: { "cache-control": "no-store" } });
}
