import "server-only";
import { getEnv } from "./cf";
import { getCurrentSeason, getSettings } from "./data";
import { all, first, parseJson } from "./db";
import { cleanForm, EMPTY_FORM, matchKeyLabel, type ScoutingData, type ScoutingForm } from "./scouting";
import { tbaCachedJson } from "./tba/cache";
import type { TbaEnv, TbaEvent, TbaMatch, TbaRecord, TbaTeamEventStatus } from "./tba/client";

// ---- What the /scouting app gets ---------------------------------------------

export type ScoutEvent = { key: string; name: string; start: string | null; end: string | null; location: string };

export type ScoutTeamRow = {
  number: number;
  nickname: string;
  city: string;
  rank: number | null;
  record: string | null;
  opr: number | null;
  hasRobot: boolean;
  reports: number;
};

export type ScoutEntry = {
  clientId: string;
  kind: "robot" | "report";
  team: number;
  eventKey: string | null;
  matchKey: string | null;
  data: ScoutingData;
  scouter: string;
  createdAt: string;
  updatedAt: string;
};

export type ScoutMatch = {
  key: string;
  label: string;
  red: number[];
  blue: number[];
  redScore: number | null;
  blueScore: number | null;
  /** Which side this team was on. */
  alliance: "red" | "blue" | null;
  result: "win" | "loss" | "tie" | null;
  time: number | null;
};

export type TeamDetail = {
  number: number;
  nickname: string;
  name: string;
  city: string;
  rookieYear: number | null;
  website: string | null;
  /** This season's events for the team, for switching which event's results show. */
  events: { key: string; name: string }[];
  event: {
    key: string;
    name: string;
    rank: number | null;
    teams: number | null;
    record: string | null;
    status: string | null;
    opr: number | null;
    matches: ScoutMatch[];
  } | null;
  photos: string[];
  robot: ScoutEntry | null;
  reports: ScoutEntry[];
};

// ---- Settings and form --------------------------------------------------------

export async function getScoutingForm(year: number): Promise<ScoutingForm> {
  const row = await first<{ fields: string }>("SELECT fields FROM scouting_forms WHERE season_year = ?", year);
  return row ? cleanForm(parseJson(row.fields, EMPTY_FORM)) : EMPTY_FORM;
}

/** Events 1209 is at this season that are on TBA, soonest first. */
export async function getScoutingEvents(year: number): Promise<ScoutEvent[]> {
  const rows = await all<{ tba_key: string; name: string; start_date: string | null; end_date: string | null; location: string | null }>(
    `SELECT tba_key, name, start_date, end_date, location FROM events
     WHERE season_year = ? AND tba_key IS NOT NULL AND hidden = 0 ORDER BY start_date, name`,
    year,
  );
  return rows.map((r) => ({ key: r.tba_key, name: r.name, start: r.start_date, end: r.end_date, location: r.location ?? "" }));
}

// ---- Entries ------------------------------------------------------------------

type EntryRow = {
  id: number;
  client_id: string;
  kind: "robot" | "report";
  team_number: number;
  event_key: string | null;
  match_key: string | null;
  data: string;
  scouter: string;
  created_at: string;
  updated_at: string;
};

export function toScoutEntry(r: EntryRow): ScoutEntry {
  return {
    clientId: r.client_id,
    kind: r.kind,
    team: r.team_number,
    eventKey: r.event_key,
    matchKey: r.match_key,
    data: parseJson<ScoutingData>(r.data, {}),
    scouter: r.scouter,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const ENTRY_COLUMNS = "id, client_id, kind, team_number, event_key, match_key, data, scouter, created_at, updated_at";

export async function getTeamEntries(year: number, team: number) {
  const rows = await all<EntryRow>(
    `SELECT ${ENTRY_COLUMNS} FROM scouting_entries
     WHERE season_year = ? AND team_number = ? AND deleted_at IS NULL
     ORDER BY kind = 'robot' DESC, created_at DESC`,
    year,
    team,
  );
  const entries = rows.map(toScoutEntry);
  return { robot: entries.find((e) => e.kind === "robot") ?? null, reports: entries.filter((e) => e.kind === "report") };
}

/** Per team this season: whether it has a robot sheet, and how many reports. */
export async function getScoutingCounts(year: number): Promise<Map<number, { robot: boolean; reports: number }>> {
  const rows = await all<{ team_number: number; robot: number; reports: number }>(
    `SELECT team_number, SUM(kind = 'robot') AS robot, SUM(kind = 'report') AS reports
     FROM scouting_entries WHERE season_year = ? AND deleted_at IS NULL GROUP BY team_number`,
    year,
  );
  return new Map(rows.map((r) => [r.team_number, { robot: r.robot > 0, reports: r.reports }]));
}

// ---- The Blue Alliance --------------------------------------------------------

type TbaTeamSimple = { key: string; team_number: number; nickname: string | null; name?: string | null; city: string | null; state_prov: string | null; country: string | null };
type TbaTeam = TbaTeamSimple & { rookie_year: number | null; website: string | null };
type TbaRankings = { rankings: { team_key: string; rank: number; record: TbaRecord | null }[] } | null;
type TbaOprs = { oprs?: Record<string, number> } | null;
type TbaMedia = { type: string; foreign_key: string; direct_url?: string | null; preferred?: boolean }[];

const place = (t: { city: string | null; state_prov: string | null; country: string | null }) =>
  [t.city, t.state_prov, t.country && t.country !== "USA" ? t.country : null].filter(Boolean).join(", ");

const recordText = (r: TbaRecord | null | undefined) => (r ? `${r.wins}-${r.losses}-${r.ties}` : null);

const LEVEL_ORDER: Record<string, number> = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };

/** Every team at an event, with rank, record, OPR and how much we've scouted them. */
export async function getEventTeams(env: TbaEnv, year: number, eventKey: string): Promise<ScoutTeamRow[]> {
  const [teams, rankings, oprs, counts] = await Promise.all([
    tbaCachedJson<TbaTeamSimple[]>(env, `/event/${eventKey}/teams/simple`, 3600),
    tbaCachedJson<TbaRankings>(env, `/event/${eventKey}/rankings`, 180),
    tbaCachedJson<TbaOprs>(env, `/event/${eventKey}/oprs`, 300),
    getScoutingCounts(year),
  ]);
  const rankBy = new Map((rankings?.rankings ?? []).map((r) => [r.team_key, r]));
  return (teams ?? [])
    .map((t) => {
      const r = rankBy.get(t.key);
      const c = counts.get(t.team_number);
      return {
        number: t.team_number,
        nickname: t.nickname ?? t.name ?? "",
        city: place(t),
        rank: r?.rank ?? null,
        record: recordText(r?.record),
        opr: oprs?.oprs?.[t.key] ?? null,
        hasRobot: c?.robot ?? false,
        reports: c?.reports ?? 0,
      };
    })
    .sort((a, b) => a.number - b.number);
}

function photoUrls(media: TbaMedia | null): string[] {
  return (media ?? [])
    .sort((a, b) => Number(b.preferred ?? false) - Number(a.preferred ?? false))
    .map((m) => (m.type === "imgur" ? `https://i.imgur.com/${m.foreign_key}.jpg` : m.direct_url && /^https:\/\//.test(m.direct_url) ? m.direct_url : null))
    .filter((u): u is string => Boolean(u))
    .slice(0, 4);
}

export async function getTeamDetail(env: TbaEnv, year: number, team: number, eventParam: string | null, ourEvents: ScoutEvent[]): Promise<TeamDetail> {
  const key = `frc${team}`;
  const [info, teamEvents, media, entries] = await Promise.all([
    tbaCachedJson<TbaTeam>(env, `/team/${key}`, 86400),
    tbaCachedJson<TbaEvent[]>(env, `/team/${key}/events/${year}/simple`, 3600),
    tbaCachedJson<TbaMedia>(env, `/team/${key}/media/${year}`, 3600),
    getTeamEntries(year, team),
  ]);
  const events = (teamEvents ?? []).sort((a, b) => a.start_date.localeCompare(b.start_date)).map((e) => ({ key: e.key, name: e.short_name || e.name }));

  // Which event's results to show: the one asked for, else one of ours they're at, else their latest.
  const ours = new Set(ourEvents.map((e) => e.key));
  const eventKey =
    (eventParam && (events.some((e) => e.key === eventParam) || ours.has(eventParam)) ? eventParam : null) ??
    events.find((e) => ours.has(e.key))?.key ??
    events.at(-1)?.key ??
    null;

  let event: TeamDetail["event"] = null;
  if (eventKey) {
    const [status, matches, oprs] = await Promise.all([
      tbaCachedJson<TbaTeamEventStatus>(env, `/team/${key}/event/${eventKey}/status`, 180),
      tbaCachedJson<TbaMatch[]>(env, `/team/${key}/event/${eventKey}/matches/simple`, 180),
      tbaCachedJson<TbaOprs>(env, `/event/${eventKey}/oprs`, 300),
    ]);
    const num = (k: string) => Number(k.replace(/^frc/, ""));
    event = {
      key: eventKey,
      name: events.find((e) => e.key === eventKey)?.name ?? ourEvents.find((e) => e.key === eventKey)?.name ?? eventKey,
      rank: status?.qual?.ranking?.rank ?? null,
      teams: status?.qual?.num_teams ?? null,
      record: recordText(status?.qual?.ranking?.record),
      status: status?.overall_status_str ? status.overall_status_str.replace(/<[^>]+>/g, "") : null,
      opr: oprs?.oprs?.[key] ?? null,
      matches: (matches ?? [])
        .sort((a, b) => (LEVEL_ORDER[a.comp_level] ?? 9) - (LEVEL_ORDER[b.comp_level] ?? 9) || a.set_number - b.set_number || a.match_number - b.match_number)
        .map((m) => {
          const alliance = m.alliances.red.team_keys.includes(key) ? "red" : m.alliances.blue.team_keys.includes(key) ? "blue" : null;
          // TBA scores unplayed matches as -1.
          const played = m.alliances.red.score >= 0 && m.alliances.blue.score >= 0;
          const result = !played || !alliance ? null : m.winning_alliance === "" ? "tie" : m.winning_alliance === alliance ? "win" : "loss";
          return {
            key: m.key,
            label: matchKeyLabel(m.key),
            red: m.alliances.red.team_keys.map(num),
            blue: m.alliances.blue.team_keys.map(num),
            redScore: played ? m.alliances.red.score : null,
            blueScore: played ? m.alliances.blue.score : null,
            alliance,
            result,
            time: m.time,
          };
        }),
    };
  }

  return {
    number: team,
    nickname: info?.nickname ?? "",
    name: info?.name ?? "",
    city: info ? place(info) : "",
    rookieYear: info?.rookie_year ?? null,
    website: info?.website && /^https?:\/\//.test(info.website) ? info.website : null,
    events,
    event,
    photos: photoUrls(media),
    robot: entries.robot,
    reports: entries.reports,
  };
}

// ---- Request context --------------------------------------------------------

/** Everything the scouting API needs: bindings, whether it's open, the season and its form. */
export async function scoutingContext() {
  const [env, settings, season] = await Promise.all([getEnv(), getSettings(), getCurrentSeason()]);
  const year = season?.year ?? new Date().getFullYear();
  return { env, open: settings.scouting.open, year, form: await getScoutingForm(year) };
}

/** Team nicknames already cached from TBA, for listing teams without asking TBA again. */
export async function cachedNicknames(numbers: number[]): Promise<Map<number, string>> {
  if (numbers.length === 0) return new Map();
  const paths = numbers.map((n) => `/team/frc${n}`);
  const rows = await all<{ path: string; body: string }>(
    `SELECT path, body FROM tba_json_cache WHERE path IN (${paths.map(() => "?").join(",")})`,
    ...paths,
  );
  return new Map(
    rows.map((r) => [Number(r.path.replace("/team/frc", "")), parseJson<{ nickname?: string } | null>(r.body, null)?.nickname ?? ""]),
  );
}
