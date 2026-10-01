import "server-only";
import { batch } from "./db";
import { seasonLabel } from "./format";

// Where each file in the media library is used, for the Media library's
// "Where it's used", the delete warning, the "Not used anywhere" filter and
// merging duplicates. Keep in step with every column that points at media.

export type MediaUse = { label: string; href: string };

type Row = { media_id: number; kind: string; ref_id: number | null; name: string | null; extra: string | null; year: number | null };

const IDS = "(SELECT value FROM json_each(?))";

/**
 * Each place a file is used, as one row: what kind, which thing, its name.
 * Separate queries (run as one batch): D1 limits how many SELECTs one
 * UNION can have.
 */
const USAGE_QUERIES = [
  `SELECT ap.media_id AS media_id, 'album' AS kind, a.id AS ref_id, a.title AS name, NULL AS extra, a.season_year AS year FROM album_photos ap JOIN albums a ON a.id = ap.album_id WHERE ap.media_id IN ${IDS}`,
  `SELECT ap.media_id AS media_id, 'robot' AS kind, r.id AS ref_id, r.name AS name, NULL AS extra, r.season_year AS year FROM album_photos ap JOIN robots r ON r.album_id = ap.album_id WHERE ap.media_id IN ${IDS}`,
  `SELECT ap.media_id AS media_id, 'event' AS kind, e.id AS ref_id, e.name AS name, e.kind AS extra, e.season_year AS year FROM album_photos ap JOIN events e ON e.album_id = ap.album_id WHERE ap.media_id IN ${IDS}`,
  `SELECT a.cover_media_id AS media_id, 'album_cover' AS kind, a.id AS ref_id, a.title AS name, NULL AS extra, a.season_year AS year FROM albums a WHERE a.cover_media_id IN ${IDS}`,
  `SELECT r.photo_media_id AS media_id, 'robot' AS kind, r.id AS ref_id, r.name AS name, NULL AS extra, r.season_year AS year FROM robots r WHERE r.photo_media_id IN ${IDS} AND r.album_id IS NULL`,
  `SELECT s.hero_media_id AS media_id, 'season_photo' AS kind, s.year AS ref_id, NULL AS name, NULL AS extra, s.year AS year FROM seasons s WHERE s.hero_media_id IN ${IDS}`,
  `SELECT s.notebook_media_id AS media_id, 'notebook' AS kind, s.year AS ref_id, NULL AS name, NULL AS extra, s.year AS year FROM seasons s WHERE s.notebook_media_id IN ${IDS}`,
  `SELECT sp.logo_media_id AS media_id, 'sponsor' AS kind, sp.id AS ref_id, sp.name AS name, NULL AS extra, NULL AS year FROM sponsors sp WHERE sp.logo_media_id IN ${IDS}`,
  `SELECT p.photo_media_id AS media_id, 'person' AS kind, p.id AS ref_id, trim(p.first_name || ' ' || p.last_name) AS name, NULL AS extra, NULL AS year FROM people p WHERE p.photo_media_id IN ${IDS}`,
  `SELECT x.media_id AS media_id, 'resource' AS kind, x.id AS ref_id, x.title AS name, NULL AS extra, x.season_year AS year FROM resources x WHERE x.media_id IN ${IDS}`,
  `SELECT po.cover_media_id AS media_id, 'post' AS kind, po.id AS ref_id, po.title AS name, NULL AS extra, NULL AS year FROM posts po WHERE po.cover_media_id IN ${IDS} AND po.event_id IS NULL`,
  `SELECT CAST(json_extract(st.value, '$.media_id') AS INTEGER) AS media_id, 'plan' AS kind, NULL AS ref_id, NULL AS name, NULL AS extra, NULL AS year FROM site_settings st WHERE st.key = 'strategic_plan' AND CAST(json_extract(st.value, '$.media_id') AS INTEGER) IN ${IDS}`,
  `SELECT m.id AS media_id, 'event_video' AS kind, e.id AS ref_id, e.name AS name, e.kind AS extra, e.season_year AS year FROM media m JOIN events e ON e.highlight_video_url LIKE '%' || m.r2_key WHERE m.id IN ${IDS}`,
];

function describe(r: Row): MediaUse {
  const season = r.year ? seasonLabel(r.year) : "";
  const impact = r.extra === "outreach";
  switch (r.kind) {
    case "album":
      return { label: `In the album “${r.name}”`, href: `/admin/gallery/${r.ref_id}` };
    case "album_cover":
      return { label: `Cover of the album “${r.name}”`, href: `/admin/gallery/${r.ref_id}` };
    case "robot":
      return { label: `Photo of the robot ${r.name}${season ? ` (${season})` : ""}`, href: `/admin/robots/${r.ref_id}` };
    case "event":
      return { label: impact ? `Photo of the impact event “${r.name}”` : `Photo of the event “${r.name}”`, href: impact ? `/admin/impact/${r.ref_id}` : `/admin/events/${r.ref_id}` };
    case "event_video":
      return { label: `Video of “${r.name}”`, href: impact ? `/admin/impact/${r.ref_id}` : `/admin/events/${r.ref_id}` };
    case "season_photo":
      return { label: `The ${season} season photo`, href: `/admin/seasons/${r.ref_id}` };
    case "notebook":
      return { label: `The ${season} engineering notebook`, href: `/admin/seasons/${r.ref_id}` };
    case "sponsor":
      return { label: `Logo of the sponsor ${r.name}`, href: "/admin/sponsors" };
    case "person":
      return { label: `Photo of ${r.name}`, href: `/admin/people/${r.ref_id}` };
    case "resource":
      return { label: `Resource “${r.name}”${season ? ` (${season})` : " (every season)"}`, href: r.year ? `/admin/seasons/${r.year}` : "/admin/seasons" };
    case "post":
      return { label: `Cover of the old news post “${r.name}”`, href: "/admin/impact" };
    case "plan":
      return { label: "The Strategic Plan", href: "/admin/settings" };
    default:
      return { label: r.kind, href: "/admin" };
  }
}

/** Where each of these files is used. Files used nowhere get an empty list. */
export async function getMediaUsage(ids: number[]): Promise<Map<number, MediaUse[]>> {
  const out = new Map<number, MediaUse[]>(ids.map((id) => [id, []]));
  if (!ids.length) return out;
  const json = JSON.stringify(ids);
  const results = await batch(USAGE_QUERIES.map((q) => [q, json] as [string, string]));
  const rows = results.flatMap((r) => (r.results ?? []) as Row[]);
  for (const r of rows) {
    const use = describe(r);
    const list = out.get(r.media_id);
    if (list && !list.some((u) => u.label === use.label)) list.push(use);
  }
  return out;
}

/** SQL that's true when the file `m` is used anywhere (for the "Not used anywhere" filter). */
export const USED_SQL = `(
  EXISTS (SELECT 1 FROM album_photos ap WHERE ap.media_id = m.id)
  OR EXISTS (SELECT 1 FROM albums a WHERE a.cover_media_id = m.id)
  OR EXISTS (SELECT 1 FROM robots r WHERE r.photo_media_id = m.id)
  OR EXISTS (SELECT 1 FROM seasons s WHERE s.hero_media_id = m.id OR s.notebook_media_id = m.id)
  OR EXISTS (SELECT 1 FROM sponsors sp WHERE sp.logo_media_id = m.id)
  OR EXISTS (SELECT 1 FROM people p WHERE p.photo_media_id = m.id)
  OR EXISTS (SELECT 1 FROM resources x WHERE x.media_id = m.id)
  OR EXISTS (SELECT 1 FROM posts po WHERE po.cover_media_id = m.id AND po.event_id IS NULL)
  OR EXISTS (SELECT 1 FROM site_settings st WHERE st.key = 'strategic_plan' AND CAST(json_extract(st.value, '$.media_id') AS INTEGER) = m.id)
  OR EXISTS (SELECT 1 FROM events e WHERE e.highlight_video_url LIKE '%' || m.r2_key)
)`;
