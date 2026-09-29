import "server-only";
import { all, first } from "./db";

export type MediaOption = { id: number; r2_key: string; filename: string };

/** Recent images for the "pick from library" dropdowns. */
export async function getMediaOptions(limit = 300): Promise<MediaOption[]> {
  return all<MediaOption>(
    "SELECT id, r2_key, filename FROM media WHERE content_type LIKE 'image/%' ORDER BY created_at DESC LIMIT ?",
    limit,
  );
}

export async function getMediaOption(id: number | null | undefined): Promise<MediaOption | null> {
  if (!id) return null;
  return first<MediaOption>("SELECT id, r2_key, filename FROM media WHERE id = ?", id);
}

export async function getSeasonYears(): Promise<number[]> {
  const rows = await all<{ year: number }>("SELECT year FROM seasons ORDER BY year DESC");
  return rows.map((r) => r.year);
}

export async function getCurrentYear(): Promise<number | null> {
  const row = await first<{ year: number }>("SELECT year FROM seasons ORDER BY is_current DESC, year DESC LIMIT 1");
  return row?.year ?? null;
}

export type TbaStatus = { at: string; trigger: string; ok: boolean; message: string; errors: string[] };

/** Result of the last Blue Alliance sync (manual or automatic). */
export async function getTbaStatus(): Promise<TbaStatus | null> {
  const row = await first<{ value: string }>("SELECT value FROM site_settings WHERE key = 'tba_status'");
  try {
    return row ? (JSON.parse(row.value) as TbaStatus) : null;
  } catch {
    return null;
  }
}

/** Resolves ?season= against existing seasons, defaulting to the current one. */
export async function resolveSeasonParam(raw: string | string[] | undefined): Promise<{ year: number | null; years: number[] }> {
  const years = await getSeasonYears();
  const wanted = Number(Array.isArray(raw) ? raw[0] : raw);
  if (years.includes(wanted)) return { year: wanted, years };
  return { year: (await getCurrentYear()) ?? years[0] ?? null, years };
}
