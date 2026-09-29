// Read-through cache for The Blue Alliance data the scouting pages show.
// Unlike tbaGet (which only says whether data changed, for the sync job),
// this keeps the response itself, so it can be served again without asking
// TBA and still shown if TBA is slow or down.

import { tbaConfigured, type TbaEnv } from "./client";

type Row = { etag: string | null; body: string; fetched_at: string };

/**
 * GET a TBA path, reusing a copy younger than `maxAgeSeconds`. Older copies
 * are revalidated with If-None-Match. Returns null when TBA has nothing (404),
 * isn't set up, or can't be reached and nothing is cached.
 */
export async function tbaCachedJson<T>(env: TbaEnv, path: string, maxAgeSeconds = 300): Promise<T | null> {
  const row = await env.DB.prepare("SELECT etag, body, fetched_at FROM tba_json_cache WHERE path = ?").bind(path).first<Row>();
  const cached = row ? (JSON.parse(row.body) as T | null) : null;
  const age = row ? (Date.now() - Date.parse(row.fetched_at)) / 1000 : Infinity;
  if (row && age < maxAgeSeconds) return cached;
  if (!tbaConfigured(env)) return cached;

  const base = (env.TBA_BASE_URL || "https://www.thebluealliance.com/api/v3").replace(/\/$/, "");
  const headers: Record<string, string> = { "X-TBA-Auth-Key": env.TBA_API_KEY!.trim(), accept: "application/json" };
  if (row?.etag) headers["If-None-Match"] = row.etag;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(8000) });
  } catch {
    return cached;
  }
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  if (res.status === 304 && row) {
    await env.DB.prepare("UPDATE tba_json_cache SET fetched_at = ? WHERE path = ?").bind(now, path).run();
    return cached;
  }
  if (res.status !== 404 && !res.ok) return cached;

  const data = res.status === 404 ? null : ((await res.json()) as T);
  await env.DB.prepare(
    `INSERT INTO tba_json_cache (path, etag, body, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET etag = excluded.etag, body = excluded.body, fetched_at = excluded.fetched_at`,
  )
    .bind(path, res.headers.get("etag"), JSON.stringify(data), now)
    .run();
  return data;
}
