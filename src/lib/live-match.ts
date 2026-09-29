import "server-only";
import { cache } from "react";
import { getEnv } from "./cf";
import { getLiveEvents, getMatches } from "./data";
import { tbaCachedJson } from "./tba/cache";
import { teamKey, tbaConfigured, type TbaMatch, type TbaTeamEventStatus } from "./tba/client";
import { matchFields, matchLabel, statusFields } from "./tba/map";
import type { Match, TeamEvent } from "./types";

// Our next and last match at an event happening today, for the card above
// the homepage hero. Straight from The Blue Alliance (reused for a minute),
// or, without a TBA key, from the matches the sync job saved.

export type LiveMatch = {
  key: string;
  label: string;
  /** Unix seconds. TBA's predicted time when it has one, else the schedule. */
  time: number | null;
  predicted: boolean;
  alliance: "red" | "blue";
  partners: string[];
  opponents: string[];
  ourScore: number | null;
  theirScore: number | null;
  result: "win" | "loss" | "tie" | "";
};

export type LiveMatchData = {
  /** Our team number. */
  team: string;
  event: { id: number; name: string; url: string; webcast: string | null; timezone: string };
  next: LiveMatch | null;
  last: LiveMatch | null;
  /** "Rank 8 of 48", "7-3-0", "Captain, Alliance 3", "Playing in semifinals"… */
  status: string[];
  /** Every match of ours is played and we're out (or won). */
  finished: boolean;
};

const MAX_AGE = 60;
const LEVEL = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 } as Record<string, number>;
const order = (a: { comp_level: string; set_number: number; match_number: number }, b: typeof a) =>
  (LEVEL[a.comp_level] ?? 5) - (LEVEL[b.comp_level] ?? 5) || a.set_number - b.set_number || a.match_number - b.match_number;

function fromTba(m: TbaMatch, team: string): LiveMatch | null {
  const { structural, tba } = matchFields(m, team);
  const ours = structural.our_alliance as "red" | "blue" | null;
  if (!ours) return null;
  const theirs = ours === "red" ? "blue" : "red";
  const keys = (side: "red" | "blue") => m.alliances[side].team_keys.map((k) => k.replace(/^frc/, ""));
  const us = team.replace(/^frc/, "");
  return {
    key: m.key,
    label: matchLabel(m),
    time: m.predicted_time ?? m.time ?? null,
    predicted: Boolean(m.predicted_time),
    alliance: ours,
    partners: keys(ours).filter((t) => t !== us),
    opponents: keys(theirs),
    ourScore: ours === "red" ? tba.red_score : tba.blue_score,
    theirScore: ours === "red" ? tba.blue_score : tba.red_score,
    result: tba.result as LiveMatch["result"],
  };
}

function fromSaved(m: Match, us: string): LiveMatch | null {
  if (!m.our_alliance) return null;
  const list = (s: string) => s.split(/[\s,]+/).filter(Boolean);
  const red = m.our_alliance === "red";
  return {
    key: String(m.id),
    label: matchLabel(m),
    time: m.time,
    predicted: false,
    alliance: m.our_alliance,
    partners: list(red ? m.red_teams : m.blue_teams).filter((t) => t !== us),
    opponents: list(red ? m.blue_teams : m.red_teams),
    ourScore: red ? m.red_score : m.blue_score,
    theirScore: red ? m.blue_score : m.red_score,
    result: m.result,
  };
}

const played = (m: LiveMatch) => m.ourScore != null && m.theirScore != null;

async function forEvent(event: TeamEvent): Promise<LiveMatchData> {
  const env = await getEnv();
  const team = teamKey(env);
  let matches: LiveMatch[] = [];
  let status = [event.rank, event.record, event.alliance, event.playoff_result];
  let out = /eliminated|winners/i.test(event.playoff_result);

  const tba =
    tbaConfigured(env) && event.tba_key
      ? await Promise.all([
          tbaCachedJson<TbaMatch[]>(env, `/team/${team}/event/${event.tba_key}/matches/simple`, MAX_AGE),
          tbaCachedJson<TbaTeamEventStatus>(env, `/team/${team}/event/${event.tba_key}/status`, MAX_AGE),
        ]).catch((e) => {
          console.error("live match: TBA failed", e);
          return null;
        })
      : null;

  if (tba?.[0]) {
    matches = [...tba[0]].sort(order).map((m) => fromTba(m, team)).filter((m): m is LiveMatch => m !== null);
    if (tba[1]) {
      const s = statusFields(tba[1]);
      status = [s.rank, s.record, s.alliance, s.playoff_result];
      out = tba[1]?.playoff?.status === "eliminated" || tba[1]?.playoff?.status === "won";
    }
  } else {
    const us = team.replace(/^frc/, "");
    matches = (await getMatches(event.id)).map((m) => fromSaved(m, us)).filter((m): m is LiveMatch => m !== null);
  }

  const next = matches.find((m) => !played(m)) ?? null;
  const last = matches.filter(played).at(-1) ?? null;
  return {
    team: team.replace(/^frc/, ""),
    event: {
      id: event.id,
      name: event.name,
      url: `/seasons/${event.season_year}/events/${event.id}`,
      webcast: event.webcast_url,
      timezone: event.timezone || "America/Chicago",
    },
    next,
    last,
    status: status.filter(Boolean),
    finished: !next && out,
  };
}

/** Competitions on today with a Blue Alliance key: the card for each. */
export const getLiveMatches = cache(async (): Promise<LiveMatchData[]> => {
  // Outside the try: Next marks the page as per-request by throwing here.
  await getEnv();
  try {
    const events = (await getLiveEvents()).filter((e) => e.tba_key && e.kind !== "outreach");
    return await Promise.all(events.map(forEvent));
  } catch (e) {
    console.error("live match failed", e);
    return [];
  }
});
