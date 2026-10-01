import "server-only";
import { cache } from "react";
import { getMediaFile, getRobots, getSeason, getSettings } from "./data";
import { all, first, parseJson } from "./db";
import { documentLink, downloadUrl } from "./media";
import { matchKeyLabel, type ScoutingData, type ScoutingForm } from "./scouting";
import { cachedNicknames, getScoutingForm } from "./scouting-data";

// What a season page's Scouting and Resources tabs show.

// ---- Scouting ------------------------------------------------------------------------

export async function isScoutingPublished(year: number): Promise<boolean> {
  const row = await first<{ published: number }>("SELECT published FROM scouting_forms WHERE season_year = ?", year).catch(() => null);
  return row?.published === 1;
}

export type PublicReport = { event: string | null; match: string; data: ScoutingData; date: string };
export type PublicTeam = { number: number; nickname: string; robot: ScoutingData | null; reports: PublicReport[] };
export type PublicScouting = { form: ScoutingForm; teams: PublicTeam[]; events: { key: string; name: string }[] };

/**
 * Everything scouted in a season, for the public Scouting tab: robot sheets
 * and match reports, notes included, but not who wrote them. Null unless an
 * admin has switched publishing on for the season.
 */
export const getPublicScouting = cache(async (year: number): Promise<PublicScouting | null> => {
  if (!(await isScoutingPublished(year))) return null;
  const [form, rows, eventRows] = await Promise.all([
    getScoutingForm(year),
    all<{ kind: "robot" | "report"; team_number: number; event_key: string | null; match_key: string | null; data: string; created_at: string }>(
      `SELECT kind, team_number, event_key, match_key, data, created_at FROM scouting_entries
       WHERE season_year = ? AND deleted_at IS NULL ORDER BY team_number, created_at`,
      year,
    ),
    all<{ tba_key: string; name: string }>("SELECT tba_key, name FROM events WHERE season_year = ? AND tba_key IS NOT NULL AND hidden = 0 ORDER BY start_date", year),
  ]);
  const byTeam = new Map<number, PublicTeam>();
  for (const r of rows) {
    const team = byTeam.get(r.team_number) ?? { number: r.team_number, nickname: "", robot: null, reports: [] };
    const data = parseJson<ScoutingData>(r.data, {});
    if (r.kind === "robot") team.robot = data;
    else team.reports.push({ event: r.event_key, match: r.match_key ? matchKeyLabel(r.match_key) : "General note", data, date: r.created_at });
    byTeam.set(r.team_number, team);
  }
  const names = await cachedNicknames([...byTeam.keys()]);
  const teams = [...byTeam.values()].map((t) => ({ ...t, nickname: names.get(t.number) ?? "" }));
  return { form, teams, events: eventRows.map((e) => ({ key: e.tba_key, name: e.name })) };
});

// ---- Resources ---------------------------------------------------------------------

export type ResourceItem = {
  key: string;
  title: string;
  description: string;
  href: string;
  /** "Opens a page", "PDF", "GitHub"… shown small under the title. */
  kind: string;
  external: boolean;
  /** A team document, shown on every season. */
  team: boolean;
};

export type StoredResource = {
  id: number;
  season_year: number | null;
  title: string;
  description: string;
  url: string | null;
  media_id: number | null;
  r2_key: string | null;
  content_type: string | null;
  filename: string | null;
  sort_order: number;
};

/** A season's own resources and the team documents, in order (admin and site). */
export async function getStoredResources(year: number): Promise<StoredResource[]> {
  return all<StoredResource>(
    `SELECT r.id, r.season_year, r.title, r.description, r.url, r.media_id, m.r2_key, m.content_type, m.filename, r.sort_order
     FROM resources r LEFT JOIN media m ON m.id = r.media_id
     WHERE r.season_year = ? OR r.season_year IS NULL
     ORDER BY r.season_year IS NULL, r.sort_order, r.id`,
    year,
  ).catch(() => []);
}

function linkKind(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "github.com") return "GitHub";
    if (host.endsWith("onshape.com")) return "Onshape";
    if (host.endsWith("google.com")) return "Google";
    if (host.endsWith("youtube.com") || host === "youtu.be") return "YouTube";
    return host;
  } catch {
    return "Link";
  }
}

function fileKind(type: string | null, filename: string | null): string {
  if (type === "application/pdf") return "PDF";
  if (type?.startsWith("image/")) return "Image";
  if (type?.startsWith("video/")) return "Video";
  return filename?.split(".").pop()?.toUpperCase() ?? "File";
}

export function storedToItem(r: StoredResource): ResourceItem | null {
  const file = r.r2_key ? downloadUrl(r.r2_key) : null;
  const href = file ?? r.url;
  if (!href) return null;
  return {
    key: `r${r.id}`,
    title: r.title,
    description: r.description,
    href,
    kind: file ? fileKind(r.content_type, r.filename) : linkKind(href),
    external: !file,
    team: r.season_year === null,
  };
}

/**
 * The Resources tab: what's filled in automatically (each robot's code and
 * CAD, the engineering notebook, the Scouting tab, the Strategic Plan), then
 * what admins added for the season, then the team documents.
 */
export const getSeasonResources = cache(async (year: number): Promise<{ season: ResourceItem[]; team: ResourceItem[] }> => {
  const [season, robots, settings, stored, scouting] = await Promise.all([
    getSeason(year),
    getRobots(year),
    getSettings(),
    getStoredResources(year),
    isScoutingPublished(year),
  ]);
  const auto: ResourceItem[] = [];
  for (const r of robots) {
    if (r.code_url) auto.push({ key: `code${r.id}`, title: `${r.name} robot code`, description: `Everything ${r.name} runs, from autonomous to the driver controls.`, href: r.code_url, kind: linkKind(r.code_url), external: true, team: false });
    if (r.cad_url) auto.push({ key: `cad${r.id}`, title: `${r.name} CAD`, description: `The full 3D model of ${r.name}.`, href: r.cad_url, kind: linkKind(r.cad_url), external: true, team: false });
  }
  const notebook = season ? documentLink(season.notebook_key, season.notebook_url) : null;
  if (notebook) {
    auto.push({ key: "notebook", title: `${year} engineering notebook`, description: "How we designed, built and improved the robot this season.", href: notebook.href, kind: notebook.external ? linkKind(notebook.href) : "PDF", external: notebook.external, team: false });
  }
  if (scouting) {
    auto.push({ key: "scouting", title: `${year} scouting data`, description: "What our scouts noted about every team we scouted, match by match.", href: `/seasons/${year}/scouting`, kind: "Scouting tab", external: false, team: false });
  }

  const items = stored.map((r) => storedToItem(r)).filter((r): r is ResourceItem => r !== null);
  const team: ResourceItem[] = [];
  const planFile = await getMediaFile(settings.strategic_plan.media_id);
  const plan = documentLink(planFile?.r2_key, settings.strategic_plan.url);
  if (plan) {
    team.push({ key: "plan", title: "Strategic Plan", description: settings.strategic_plan.summary.split("\n")[0]?.slice(0, 200) ?? "", href: plan.href, kind: plan.external ? linkKind(plan.href) : "PDF", external: plan.external, team: true });
  }
  return { season: [...auto, ...items.filter((i) => !i.team)], team: [...team, ...items.filter((i) => i.team)] };
});

/** Which tabs a season page has, besides Overview. */
export const getSeasonTabs = cache(async (year: number) => {
  const [scouting, resources] = await Promise.all([isScoutingPublished(year), getSeasonResources(year)]);
  return { scouting, resources: resources.season.length + resources.team.length > 0 };
});
