// Which event and match fields come from TBA (and so can be overridden), with
// the labels the admin shows for them.

export const EVENT_TBA_FIELDS = [
  { name: "name", label: "Event name" },
  { name: "kind", label: "Type" },
  { name: "location", label: "Location" },
  { name: "start_date", label: "Start date", type: "date" },
  { name: "end_date", label: "End date", type: "date" },
  { name: "website", label: "Event website", type: "url" },
  { name: "webcast_url", label: "Webcast link", type: "url" },
  { name: "rank", label: "Qualification rank" },
  { name: "record", label: "Qualification record (W-L-T)" },
  { name: "alliance", label: "Alliance" },
  { name: "playoff_result", label: "Playoff result" },
  { name: "awards", label: "Awards" },
] as const;

export const MATCH_TBA_FIELDS = [
  { name: "red_teams", label: "Red alliance teams" },
  { name: "blue_teams", label: "Blue alliance teams" },
  { name: "red_score", label: "Red score", type: "number" },
  { name: "blue_score", label: "Blue score", type: "number" },
  { name: "result", label: "Our result" },
  { name: "video_url", label: "Video link", type: "url" },
] as const;

export type EventTbaField = (typeof EVENT_TBA_FIELDS)[number]["name"];
export type MatchTbaField = (typeof MATCH_TBA_FIELDS)[number]["name"];

type Value = string | number | null;

export function parseOverrides(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function parseTba(json: string | null | undefined): Record<string, Value> {
  try {
    const v = JSON.parse(json || "null");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export const same = (a: Value | undefined, b: Value | undefined) => String(a ?? "").trim() === String(b ?? "").trim();

/**
 * Works out the new overrides list when an admin saves a form.
 * A field counts as edited only if the admin changed it from what the form
 * showed (`shown`), so a TBA update that landed while the form was open
 * doesn't turn untouched fields into overrides. Setting a field back to the
 * exact TBA value clears its override.
 */
export function nextOverrides(
  fields: readonly string[],
  current: string[],
  tba: Record<string, Value>,
  shown: Record<string, Value>,
  submitted: Record<string, Value>,
): string[] {
  const out = new Set(current);
  for (const f of fields) {
    if (same(submitted[f], shown[f])) continue;
    if (f in tba && same(submitted[f], tba[f])) out.delete(f);
    else out.add(f);
  }
  return [...out];
}
