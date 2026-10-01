import "server-only";
import { cache } from "react";
import { getEnv } from "./cf";
import { FIRST_IMAGE, TODAY } from "./data";
import { all, first } from "./db";

/** Hours someone logged, or the whole event when they didn't say. */
export const HOURS = "COALESCE(a.hours, e.outreach_hours, 0)";

/**
 * An outreach event counts once it has happened, or as soon as someone is
 * logged against it (an event with no date yet).
 */
const COUNTS = `(date(e.start_date) <= ${TODAY} OR EXISTS (SELECT 1 FROM outreach_attendance x WHERE x.event_id = e.id))`;

export type OutreachTotals = { year: number; hours: number; events: number; reached: number; volunteers: number };

export async function getOutreachTotals(year: number): Promise<OutreachTotals> {
  const [events, people] = await Promise.all([
    first<{ events: number; reached: number | null }>(
      `SELECT COUNT(*) AS events, SUM(e.people_reached) AS reached
       FROM events e WHERE e.season_year = ? AND e.kind = 'outreach' AND ${COUNTS}`,
      year,
    ),
    first<{ hours: number | null; volunteers: number }>(
      `SELECT SUM(${HOURS}) AS hours, COUNT(DISTINCT a.person_id) AS volunteers
       FROM outreach_attendance a JOIN events e ON e.id = a.event_id
       WHERE e.season_year = ? AND e.kind = 'outreach'`,
      year,
    ),
  ]);
  return {
    year,
    hours: people?.hours ?? 0,
    events: events?.events ?? 0,
    reached: events?.reached ?? 0,
    volunteers: people?.volunteers ?? 0,
  };
}

/**
 * The public Impact page's numbers: the latest season (up to the current
 * one) that has any outreach logged. Null when there's none, or before the
 * outreach migration has been applied.
 */
export const getPublicOutreachTotals = cache(async (): Promise<OutreachTotals | null> => {
  // Outside the try: this marks the page as rendered per request, which Next
  // does by throwing, and that must not be caught.
  await getEnv();
  try {
    const row = await first<{ year: number }>(
      `SELECT e.season_year AS year FROM events e
       WHERE e.kind = 'outreach' AND ${COUNTS}
         AND (e.people_reached > 0 OR EXISTS (SELECT 1 FROM outreach_attendance x WHERE x.event_id = e.id))
         AND e.season_year <= (SELECT year FROM seasons ORDER BY is_current DESC, year DESC LIMIT 1)
       ORDER BY e.season_year DESC LIMIT 1`,
    );
    return row ? await getOutreachTotals(row.year) : null;
  } catch (e) {
    console.error("outreach totals unavailable (has migration 0010 been applied?)", e);
    return null;
  }
});

export type PublicOutreachEvent = {
  id: number;
  season_year: number;
  name: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  recap: string;
  people_reached: number | null;
  /** 1 when it has a published story to read. */
  has_story: number;
  /** The cover of the event's album (or its first photo), if it has one. */
  cover_key: string | null;
  upcoming: number;
};

const PUBLIC_COLUMNS = `e.id, e.season_year, e.name, e.location, e.start_date, e.end_date, e.recap, e.people_reached,
  (e.story_published = 1 AND trim(e.story) != '') AS has_story,
  m.r2_key AS cover_key, COALESCE(date(e.start_date) > ${TODAY}, 0) AS upcoming`;
const PUBLIC_FROM = `FROM events e
  LEFT JOIN albums a ON a.id = e.album_id AND a.published = 1
  LEFT JOIN media m ON m.id = COALESCE(a.cover_media_id, ${FIRST_IMAGE})`;

/**
 * Impact (outreach) events for the site, newest first: what we did and
 * where, never who went or for how long. `stories` keeps just the ones with
 * a published story; `seasonYear` just one season's.
 */
export const getPublicOutreachEvents = cache(
  async (opts: { limit?: number; stories?: boolean; seasonYear?: number } = {}): Promise<PublicOutreachEvent[]> => {
    const where = ["e.kind = 'outreach'", "e.hidden = 0"];
    const params: number[] = [];
    if (opts.stories) where.push("e.story_published = 1 AND trim(e.story) != ''");
    if (opts.seasonYear) {
      where.push("e.season_year = ?");
      params.push(opts.seasonYear);
    }
    return all<PublicOutreachEvent>(
      `SELECT ${PUBLIC_COLUMNS} ${PUBLIC_FROM} WHERE ${where.join(" AND ")}
       ORDER BY e.start_date IS NULL, e.start_date DESC, e.id DESC LIMIT ?`,
      ...params,
      opts.limit ?? 60,
    );
  },
);

export type PublicImpactEvent = PublicOutreachEvent & { story: string; story_published: number; highlight_video_url: string | null; album_id: number | null };

/** One impact event for its public page, or null if it's hidden or not an impact event. */
export const getPublicImpactEvent = cache(async (id: number): Promise<PublicImpactEvent | null> =>
  first<PublicImpactEvent>(
    `SELECT ${PUBLIC_COLUMNS}, e.story, e.story_published, e.highlight_video_url, a.id AS album_id ${PUBLIC_FROM}
     WHERE e.id = ? AND e.kind = 'outreach' AND e.hidden = 0`,
    id,
  ),
);

export type OutreachEventRow = {
  id: number;
  name: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  outreach_hours: number | null;
  people_reached: number | null;
  hidden: number;
  attendees: number;
  hours: number;
  /** 1 once the event has started. */
  happened: number;
  /** "published", "draft" (written but not published) or "" (no story). */
  story: "published" | "draft" | "";
  photos: number;
};

/** A season's outreach events, newest first, with who went. */
export async function getOutreachEvents(year: number): Promise<OutreachEventRow[]> {
  return all<OutreachEventRow>(
    `SELECT e.id, e.name, e.location, e.start_date, e.end_date, e.outreach_hours, e.people_reached, e.hidden,
            COUNT(a.person_id) AS attendees, COALESCE(SUM(${HOURS}), 0) AS hours,
            COALESCE(date(e.start_date) <= ${TODAY}, 0) AS happened,
            CASE WHEN trim(e.story) = '' THEN '' WHEN e.story_published = 1 THEN 'published' ELSE 'draft' END AS story,
            (SELECT COUNT(*) FROM album_photos ap WHERE ap.album_id = e.album_id) AS photos
     FROM events e LEFT JOIN outreach_attendance a ON a.event_id = e.id
     WHERE e.season_year = ? AND e.kind = 'outreach'
     GROUP BY e.id
     ORDER BY e.start_date IS NULL DESC, e.start_date DESC, e.id DESC`,
    year,
  );
}

export type OutreachPersonTotal = {
  person_id: number;
  first_name: string;
  last_name: string;
  kind: "student" | "mentor";
  graduation_year: number | null;
  events: number;
  hours: number;
};

/** Everyone who did outreach in a season, most hours first. Admin only. */
export async function getOutreachPeople(year: number): Promise<OutreachPersonTotal[]> {
  return all<OutreachPersonTotal>(
    `SELECT p.id AS person_id, p.first_name, p.last_name, p.kind, p.graduation_year,
            COUNT(*) AS events, SUM(${HOURS}) AS hours
     FROM outreach_attendance a
     JOIN events e ON e.id = a.event_id
     JOIN people p ON p.id = a.person_id
     WHERE e.season_year = ? AND e.kind = 'outreach'
     GROUP BY p.id
     ORDER BY hours DESC, p.first_name, p.last_name`,
    year,
  );
}

/** One line per person per event, for the CSV. */
export async function getOutreachLog(year: number) {
  return all<{
    event: string;
    start_date: string | null;
    first_name: string;
    last_name: string;
    kind: string;
    graduation_year: number | null;
    hours: number;
  }>(
    `SELECT e.name AS event, e.start_date, p.first_name, p.last_name, p.kind, p.graduation_year, ${HOURS} AS hours
     FROM outreach_attendance a
     JOIN events e ON e.id = a.event_id
     JOIN people p ON p.id = a.person_id
     WHERE e.season_year = ? AND e.kind = 'outreach'
     ORDER BY e.start_date, e.name, p.last_name, p.first_name`,
    year,
  );
}

/** "3", "2.5", "1.25": no trailing zeros. */
export function formatHours(n: number): string {
  return String(Math.round(n * 100) / 100);
}
