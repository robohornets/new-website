import "server-only";
import { cache } from "react";
import { all, first, parseJson } from "./db";
import type {
  Album,
  AlbumPhoto,
  Contact,
  Match,
  Post,
  PostCategory,
  Robot,
  RosterMember,
  Season,
  SeasonSponsor,
  SiteSettings,
  TeamEvent,
} from "./types";

export const DEFAULT_SETTINGS: SiteSettings = {
  hero: { eyebrow: "", titleTop: "Robo", titleBottom: "Hornets", intro: "" },
  stats: [],
  about: { heading: "", body: "", long: "" },
  build_steps: [],
  join: { heading: "Join the hive", body: "" },
  contact: { email: "btwrobotics@gmail.com", address: "", mapsUrl: "", intro: "" },
  socials: [],
  friend_links: [],
  donate_url: "",
  mission: "",
  values: [],
  strategic_plan: { summary: "", media_id: null, url: "", updated: "" },
};

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM site_settings");
  const settings: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  const target = settings as unknown as Record<string, unknown>;
  for (const row of rows) {
    if (row.key in settings) {
      const fallback = target[row.key];
      const parsed = parseJson<unknown>(row.value, fallback);
      // Merge objects so a missing field falls back to its default.
      target[row.key] =
        fallback && typeof fallback === "object" && !Array.isArray(fallback) && parsed && typeof parsed === "object"
          ? { ...fallback, ...parsed }
          : parsed;
    }
  }
  return settings;
});

const SEASON_COLUMNS = `s.year, s.game_name, s.summary, s.status, s.kickoff_date, s.reveal_video_url,
  s.hero_media_id, m.r2_key AS hero_key, s.is_current,
  s.notebook_media_id, nb.r2_key AS notebook_key, nb.filename AS notebook_filename, s.notebook_url`;
const SEASON_JOINS = `LEFT JOIN media m ON m.id = s.hero_media_id LEFT JOIN media nb ON nb.id = s.notebook_media_id`;

/** One file from the media library, e.g. the Strategic Plan PDF. */
export const getMediaFile = cache(async (id: number | null | undefined) =>
  id ? first<{ id: number; r2_key: string; filename: string }>("SELECT id, r2_key, filename FROM media WHERE id = ?", id) : null,
);

export const getSeasons = cache(async (): Promise<Season[]> =>
  all<Season>(
    `SELECT ${SEASON_COLUMNS} FROM seasons s ${SEASON_JOINS} ORDER BY s.year DESC`,
  ),
);

export const getCurrentSeason = cache(async (): Promise<Season | null> => {
  const current = await first<Season>(
    `SELECT ${SEASON_COLUMNS} FROM seasons s ${SEASON_JOINS}
     ORDER BY s.is_current DESC, s.year DESC LIMIT 1`,
  );
  return current;
});

export const getSeason = cache(async (year: number): Promise<Season | null> =>
  first<Season>(
    `SELECT ${SEASON_COLUMNS} FROM seasons s ${SEASON_JOINS} WHERE s.year = ?`,
    year,
  ),
);

type RobotRow = Omit<Robot, "specs" | "tags"> & { specs: string; tags: string };

function toRobot(row: RobotRow): Robot {
  return { ...row, specs: parseJson(row.specs, []), tags: parseJson(row.tags, []) };
}

const ROBOT_COLUMNS = `r.id, r.season_year, r.name, r.kind, r.description, r.specs, r.tags, r.code_url,
  r.cad_url, r.photo_media_id, m.r2_key AS photo_key, r.sort_order`;

export const getRobots = cache(async (year: number): Promise<Robot[]> => {
  const rows = await all<RobotRow>(
    `SELECT ${ROBOT_COLUMNS} FROM robots r LEFT JOIN media m ON m.id = r.photo_media_id
     WHERE r.season_year = ? ORDER BY r.sort_order, r.id`,
    year,
  );
  return rows.map(toRobot);
});

/** The main robot of each season, newest first. */
export const getFeaturedRobots = cache(async (limit = 3): Promise<Robot[]> => {
  const rows = await all<RobotRow & { game_name: string }>(
    `SELECT ${ROBOT_COLUMNS}, s.game_name FROM robots r
     JOIN seasons s ON s.year = r.season_year
     LEFT JOIN media m ON m.id = r.photo_media_id
     WHERE r.id = (SELECT r2.id FROM robots r2 WHERE r2.season_year = r.season_year
                   ORDER BY (r2.kind = 'competition') DESC, r2.sort_order, r2.id LIMIT 1)
     ORDER BY r.season_year DESC LIMIT ?`,
    limit,
  );
  return rows.map(toRobot);
});

/** A season's events. Hidden ones are left out unless `includeHidden` (admin). */
export const getEvents = cache(async (year: number, includeHidden = false): Promise<TeamEvent[]> =>
  all<TeamEvent>(
    `SELECT * FROM events WHERE season_year = ? ${includeHidden ? "" : "AND hidden = 0"}
     ORDER BY start_date IS NULL, start_date, id`,
    year,
  ),
);

export const getEvent = cache(async (id: number): Promise<TeamEvent | null> =>
  first<TeamEvent>("SELECT * FROM events WHERE id = ?", id),
);

// "Today" in Tulsa, for SQLite: UTC minus 5 hours (6 in winter) is close enough.
const TODAY = "date('now', '-5 hours')";

export const getUpcomingEvents = cache(async (limit = 3): Promise<TeamEvent[]> =>
  all<TeamEvent>(
    `SELECT * FROM events WHERE hidden = 0 AND date(start_date) > ${TODAY} ORDER BY start_date LIMIT ?`,
    limit,
  ),
);

/** Events happening right now. */
export const getLiveEvents = cache(async (): Promise<TeamEvent[]> =>
  all<TeamEvent>(
    `SELECT * FROM events WHERE hidden = 0 AND start_date IS NOT NULL
       AND date(start_date) <= ${TODAY} AND date(COALESCE(end_date, start_date)) >= ${TODAY}
     ORDER BY start_date`,
  ),
);

/** Matches in play order: quals, then playoffs by round. */
export const getMatches = cache(async (eventId: number, includeHidden = false): Promise<Match[]> =>
  all<Match>(
    `SELECT * FROM matches WHERE event_id = ? ${includeHidden ? "" : "AND hidden = 0"}
     ORDER BY CASE comp_level WHEN 'qm' THEN 0 WHEN 'ef' THEN 1 WHEN 'qf' THEN 2 WHEN 'sf' THEN 3 WHEN 'f' THEN 4 ELSE 5 END,
              set_number, match_number, id`,
    eventId,
  ),
);

export const getRoster = cache(async (year: number): Promise<RosterMember[]> =>
  all<RosterMember>(
    `SELECT p.id, p.first_name, p.last_name, p.kind, p.bio, p.photo_media_id, m.r2_key AS photo_key,
            p.show_photo, p.graduation_year, e.id AS entry_id, e.role, e.subteam, e.is_leadership, e.sort_order
     FROM roster_entries e
     JOIN people p ON p.id = e.person_id
     LEFT JOIN media m ON m.id = p.photo_media_id
     WHERE e.season_year = ?
     ORDER BY p.kind = 'mentor', e.is_leadership DESC, e.sort_order, p.first_name`,
    year,
  ),
);

const POST_COLUMNS = `p.id, p.slug, p.title, p.category, p.excerpt, p.body, p.cover_media_id,
  m.r2_key AS cover_key, p.season_year, p.published, p.published_at, p.created_at, p.updated_at`;

export const getPosts = cache(
  async (opts: { category?: PostCategory; limit?: number; seasonYear?: number } = {}): Promise<Post[]> => {
    const where = ["p.published = 1"];
    const params: (string | number)[] = [];
    if (opts.category) {
      where.push("p.category = ?");
      params.push(opts.category);
    }
    if (opts.seasonYear) {
      where.push("p.season_year = ?");
      params.push(opts.seasonYear);
    }
    params.push(opts.limit ?? 100);
    return all<Post>(
      `SELECT ${POST_COLUMNS} FROM posts p LEFT JOIN media m ON m.id = p.cover_media_id
       WHERE ${where.join(" AND ")} ORDER BY p.published_at DESC, p.id DESC LIMIT ?`,
      ...params,
    );
  },
);

export const getPost = cache(async (slug: string): Promise<Post | null> =>
  first<Post>(
    `SELECT ${POST_COLUMNS} FROM posts p LEFT JOIN media m ON m.id = p.cover_media_id
     WHERE p.slug = ? AND p.published = 1`,
    slug,
  ),
);

export const getSeasonSponsors = cache(async (year: number): Promise<SeasonSponsor[]> =>
  all<SeasonSponsor>(
    `SELECT s.id, s.name, s.url, s.description, s.logo_media_id, m.r2_key AS logo_key,
            t.id AS tier_id, t.name AS tier_name, t.rank AS tier_rank, ss.sort_order
     FROM sponsor_seasons ss
     JOIN sponsors s ON s.id = ss.sponsor_id
     JOIN sponsor_tiers t ON t.id = ss.tier_id
     LEFT JOIN media m ON m.id = s.logo_media_id
     WHERE ss.season_year = ?
     ORDER BY t.rank, ss.sort_order, s.name`,
    year,
  ),
);

/** Sponsors for the newest season that has any. */
export const getLatestSponsors = cache(async (): Promise<{ year: number | null; sponsors: SeasonSponsor[] }> => {
  const current = await getCurrentSeason();
  if (current) {
    const sponsors = await getSeasonSponsors(current.year);
    if (sponsors.length) return { year: current.year, sponsors };
  }
  const latest = await first<{ year: number }>("SELECT MAX(season_year) AS year FROM sponsor_seasons");
  if (!latest?.year) return { year: null, sponsors: [] };
  return { year: latest.year, sponsors: await getSeasonSponsors(latest.year) };
});

// The cover is the chosen one, or else the album's first image (never a video).
const FIRST_IMAGE = `(SELECT ap.media_id FROM album_photos ap JOIN media mi ON mi.id = ap.media_id
  WHERE ap.album_id = a.id AND mi.content_type LIKE 'image/%' ORDER BY ap.sort_order LIMIT 1)`;
export const ALBUM_COLUMNS = `a.id, a.slug, a.title, a.description, a.season_year, a.published, a.created_at,
  COALESCE(a.cover_media_id, ${FIRST_IMAGE}) AS cover_media_id,
  (SELECT m.r2_key FROM media m WHERE m.id = COALESCE(a.cover_media_id, ${FIRST_IMAGE})) AS cover_key,
  (SELECT COUNT(*) FROM album_photos ap WHERE ap.album_id = a.id) AS photo_count`;

export const getAlbums = cache(async (seasonYear?: number): Promise<Album[]> =>
  seasonYear
    ? all<Album>(
        `SELECT ${ALBUM_COLUMNS} FROM albums a WHERE a.published = 1 AND a.season_year = ?
         ORDER BY a.created_at DESC`,
        seasonYear,
      )
    : all<Album>(
        `SELECT ${ALBUM_COLUMNS} FROM albums a WHERE a.published = 1
         ORDER BY a.season_year IS NULL, a.season_year DESC, a.created_at DESC`,
      ),
);

export const getAlbum = cache(async (slug: string): Promise<Album | null> =>
  first<Album>(`SELECT ${ALBUM_COLUMNS} FROM albums a WHERE a.slug = ? AND a.published = 1`, slug),
);

export const getAlbumPhotos = cache(async (albumId: number, limit = 500): Promise<AlbumPhoto[]> =>
  all<AlbumPhoto>(
    `SELECT ap.media_id, m.r2_key, m.content_type, m.width, m.height, m.alt, ap.caption, ap.sort_order
     FROM album_photos ap JOIN media m ON m.id = ap.media_id
     WHERE ap.album_id = ? ORDER BY ap.sort_order, m.created_at LIMIT ?`,
    albumId,
    limit,
  ),
);

/** A handful of photos from the newest albums of a season, for previews. */
export const getSeasonPhotos = cache(async (year: number, limit = 4): Promise<AlbumPhoto[]> =>
  all<AlbumPhoto>(
    `SELECT ap.media_id, m.r2_key, m.content_type, m.width, m.height, m.alt, ap.caption, ap.sort_order
     FROM album_photos ap
     JOIN albums a ON a.id = ap.album_id
     JOIN media m ON m.id = ap.media_id
     WHERE a.season_year = ? AND a.published = 1 AND m.content_type LIKE 'image/%'
     ORDER BY a.created_at DESC, ap.sort_order LIMIT ?`,
    year,
    limit,
  ),
);

export const getContacts = cache(async (): Promise<Contact[]> =>
  all<Contact>("SELECT * FROM contacts ORDER BY sort_order, id"),
);
