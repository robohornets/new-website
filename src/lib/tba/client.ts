// The Blue Alliance API v3 client. Plain Worker code (no Next.js imports), so
// the cron handler in worker.ts can use it too.
//
// Docs: https://www.thebluealliance.com/apidocs/v3

export type TbaEnv = Pick<CloudflareEnv, "DB"> & {
  TBA_API_KEY?: string;
  TBA_TEAM_KEY?: string;
  TBA_BASE_URL?: string;
};

export class TbaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export function teamKey(env: TbaEnv): string {
  const raw = (env.TBA_TEAM_KEY || "frc1209").trim().toLowerCase();
  return raw.startsWith("frc") ? raw : `frc${raw}`;
}

export function tbaConfigured(env: TbaEnv): boolean {
  return Boolean(env.TBA_API_KEY?.trim());
}

type Result<T> = { changed: true; data: T } | { changed: false };

/**
 * GET a TBA path. Sends the ETag from the last fetch so TBA can answer
 * "304 Not Modified", in which case nothing needs to be processed.
 * `force` skips the ETag (used by the manual "Sync now" button).
 */
export async function tbaGet<T>(env: TbaEnv, path: string, { force = false } = {}): Promise<Result<T>> {
  const key = env.TBA_API_KEY?.trim();
  if (!key) throw new TbaError("No TBA API key is set up yet.");
  const base = (env.TBA_BASE_URL || "https://www.thebluealliance.com/api/v3").replace(/\/$/, "");

  const cached = force
    ? null
    : await env.DB.prepare("SELECT etag FROM tba_cache WHERE path = ?").bind(path).first<{ etag: string | null }>();
  const headers: Record<string, string> = { "X-TBA-Auth-Key": key, accept: "application/json" };
  if (cached?.etag) headers["If-None-Match"] = cached.etag;

  const res = await fetch(`${base}${path}`, { headers });
  if (res.status === 304) return { changed: false };
  if (res.status === 401) throw new TbaError("The Blue Alliance rejected the API key. Check TBA_API_KEY.", 401);
  if (res.status === 404) return { changed: true, data: null as T };
  if (!res.ok) throw new TbaError(`The Blue Alliance returned an error (${res.status}) for ${path}.`, res.status);

  const data = (await res.json()) as T;
  const etag = res.headers.get("etag");
  await env.DB.prepare(
    `INSERT INTO tba_cache (path, etag, fetched_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(path) DO UPDATE SET etag = excluded.etag, fetched_at = excluded.fetched_at`,
  )
    .bind(path, etag)
    .run();
  return { changed: true, data };
}

// ---- The parts of TBA's models we use --------------------------------------

export type TbaWebcast = { type: string; channel: string; file?: string | null; date?: string | null };

export type TbaEvent = {
  key: string;
  name: string;
  short_name?: string | null;
  event_type: number;
  city: string | null;
  state_prov: string | null;
  country: string | null;
  start_date: string;
  end_date: string;
  year: number;
  website: string | null;
  timezone: string | null;
  webcasts: TbaWebcast[];
};

export type TbaRecord = { wins: number; losses: number; ties: number };

export type TbaTeamEventStatus = {
  qual: { num_teams?: number; ranking?: { rank?: number | null; record?: TbaRecord | null } | null; status?: string } | null;
  alliance: { name?: string | null; number: number; pick: number; backup?: unknown } | null;
  playoff: { level?: string; status?: string; record?: TbaRecord | null; current_level_record?: TbaRecord | null } | null;
  overall_status_str?: string;
} | null;

export type TbaMatch = {
  key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: {
    red: { score: number; team_keys: string[] };
    blue: { score: number; team_keys: string[] };
  };
  winning_alliance: string;
  time: number | null;
  /** TBA's running estimate, which drifts as the event runs ahead or behind. */
  predicted_time?: number | null;
  actual_time: number | null;
  /** Not in /matches/simple. */
  videos?: { type: string; key: string }[];
};

export type TbaAward = { name: string; award_type: number; event_key: string; year: number };
