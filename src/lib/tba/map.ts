// Turns TBA data into the values we store and show.

import type { TbaAward, TbaEvent, TbaMatch, TbaRecord, TbaTeamEventStatus, TbaWebcast } from "./client";

/** FRC game names, for seasons created by the history import. */
export const FRC_GAMES: Record<number, string> = {
  2002: "Zone Zeal",
  2003: "Stack Attack",
  2004: "FIRST Frenzy: Raising the Bar",
  2005: "Triple Play",
  2006: "Aim High",
  2007: "Rack 'n' Roll",
  2008: "FIRST Overdrive",
  2009: "Lunacy",
  2010: "Breakaway",
  2011: "Logo Motion",
  2012: "Rebound Rumble",
  2013: "Ultimate Ascent",
  2014: "Aerial Assist",
  2015: "Recycle Rush",
  2016: "FIRST Stronghold",
  2017: "FIRST Steamworks",
  2018: "FIRST Power Up",
  2019: "Destination: Deep Space",
  2020: "Infinite Recharge",
  2021: "Infinite Recharge at Home",
  2022: "Rapid React",
  2023: "Charged Up",
  2024: "Crescendo",
  2025: "Reefscape",
  2026: "Rebuilt",
};

// TBA event_type numbers → our event kinds.
function eventKind(type: number): string {
  if (type === 0) return "regional";
  if (type === 1 || type === 2 || type === 5) return "district";
  if (type === 3 || type === 4 || type === 6) return "championship";
  if (type === 99 || type === 100) return "offseason";
  return "other";
}

export function webcastUrl(webcasts: TbaWebcast[] | undefined): string | null {
  for (const w of webcasts ?? []) {
    if (w.type === "youtube" && w.channel) return `https://www.youtube.com/watch?v=${w.channel}`;
    if (w.type === "twitch" && w.channel) return `https://www.twitch.tv/${w.channel}`;
    if (/^https?:\/\//.test(w.channel ?? "")) return w.channel;
    if (/^https?:\/\//.test(w.file ?? "")) return w.file!;
  }
  return null;
}

export function eventFields(e: TbaEvent) {
  const place = [e.city, e.state_prov].filter(Boolean).join(", ");
  const country = e.country && !/^(USA|United States)$/i.test(e.country) ? e.country : "";
  return {
    name: e.name,
    kind: eventKind(e.event_type),
    location: [place, country].filter(Boolean).join(", "),
    start_date: e.start_date,
    end_date: e.end_date,
    website: e.website || null,
    webcast_url: webcastUrl(e.webcasts),
    timezone: e.timezone || null,
  };
}

const LEVELS: Record<string, string> = {
  ef: "eighth-finals",
  qf: "quarterfinals",
  sf: "semifinals",
  f: "finals",
};
const PICKS = ["Captain", "1st pick", "2nd pick", "3rd pick"];

const rec = (r: TbaRecord | null | undefined) => (r ? `${r.wins}-${r.losses}-${r.ties}` : "");

export function statusFields(s: TbaTeamEventStatus) {
  const ranking = s?.qual?.ranking;
  const alliance = s?.alliance;
  const playoff = s?.playoff;
  let playoffResult = "";
  if (playoff?.status) {
    const level = LEVELS[playoff.level ?? ""] ?? "playoffs";
    const record = rec(playoff.record);
    if (playoff.status === "won" && playoff.level === "f") playoffResult = "Event winners";
    else if (playoff.status === "eliminated") playoffResult = `Eliminated in ${level}`;
    else if (playoff.status === "playing") playoffResult = `Playing in ${level}`;
    else playoffResult = `${playoff.status} (${level})`;
    if (record) playoffResult += ` (${record})`;
  }
  return {
    rank: ranking?.rank ? `Rank ${ranking.rank}${s?.qual?.num_teams ? ` of ${s.qual.num_teams}` : ""}` : "",
    record: rec(ranking?.record),
    alliance: alliance
      ? `${PICKS[alliance.pick] ?? "Backup"}, ${alliance.name || `Alliance ${alliance.number}`}`
      : "",
    playoff_result: playoffResult,
  };
}

export function awardFields(awards: TbaAward[] | null) {
  return { awards: (awards ?? []).map((a) => a.name).join(", ") };
}

export function matchFields(m: TbaMatch, team: string) {
  const red = m.alliances.red;
  const blue = m.alliances.blue;
  const ours = red.team_keys.includes(team) ? "red" : blue.team_keys.includes(team) ? "blue" : null;
  const played = red.score >= 0 && blue.score >= 0;
  let result = "";
  if (played && ours) {
    if (m.winning_alliance === ours) result = "win";
    else if (m.winning_alliance) result = "loss";
    else result = red.score === blue.score ? "tie" : red.score > blue.score === (ours === "red") ? "win" : "loss";
  }
  const video = m.videos?.find((v) => v.type === "youtube" && v.key);
  const nums = (keys: string[]) => keys.map((k) => k.replace(/^frc/, "")).join(", ");
  return {
    structural: {
      comp_level: m.comp_level,
      set_number: m.set_number,
      match_number: m.match_number,
      time: m.actual_time ?? m.time ?? null,
      our_alliance: ours,
    },
    tba: {
      red_teams: nums(red.team_keys),
      blue_teams: nums(blue.team_keys),
      red_score: played ? red.score : null,
      blue_score: played ? blue.score : null,
      result,
      video_url: video ? `https://www.youtube.com/watch?v=${video.key}` : null,
    },
  };
}

export function matchLabel(m: { comp_level: string; set_number: number; match_number: number }): string {
  switch (m.comp_level) {
    case "qm":
      return `Qual ${m.match_number}`;
    case "f":
      return `Final ${m.match_number}`;
    case "sf":
      return m.match_number > 1 ? `Semifinal ${m.set_number}-${m.match_number}` : `Semifinal ${m.set_number}`;
    case "qf":
      return `Quarterfinal ${m.set_number}-${m.match_number}`;
    case "ef":
      return `Eighthfinal ${m.set_number}-${m.match_number}`;
    default:
      return `${m.comp_level.toUpperCase()} ${m.set_number}-${m.match_number}`;
  }
}
