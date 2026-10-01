import type { Person } from "./types";

/** Students show as "First L."; mentors show their full name. */
export function displayName(p: Pick<Person, "first_name" | "last_name" | "kind">): string {
  const last = p.last_name.trim();
  if (p.kind === "mentor") return `${p.first_name} ${last}`.trim();
  return last ? `${p.first_name} ${last[0].toUpperCase()}.` : p.first_name;
}

/** Student photos only appear when explicitly allowed; mentor photos always do. */
export function canShowPhoto(p: Pick<Person, "kind" | "show_photo" | "photo_key">): boolean {
  return Boolean(p.photo_key) && (p.kind === "mentor" || p.show_photo === 1);
}

const TZ = "America/Chicago";

function parseDate(value: string): Date {
  // Plain dates (YYYY-MM-DD) are calendar days, not UTC midnights.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "";
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ, ...opts });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function monthDay(value: string | null | undefined): { month: string; day: string } | null {
  if (!value) return null;
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: TZ }).toUpperCase(),
    day: d.toLocaleDateString("en-US", { day: "numeric", timeZone: TZ }),
  };
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

/** The placeholder admins type in a homepage stat to show the live student count. */
export const MEMBER_COUNT_TOKEN = "{members}";

/** 42 → "40+", 7 → "7". Rounded down so the "+" stays true. */
export function roundedCount(n: number): string {
  return n < 10 ? String(n) : `${Math.floor(n / 10) * 10}+`;
}

/**
 * How a season is shown: FRC seasons run from fall to spring, so the season
 * stored (and linked) as 2027 is the 2026-27 season, shown as "26-27".
 */
export function seasonLabel(year: number | null | undefined): string {
  if (year == null || !Number.isFinite(year)) return "";
  const yy = (n: number) => String(((n % 100) + 100) % 100).padStart(2, "0");
  return `${yy(year - 1)}-${yy(year)}`;
}

/** An impact (outreach) event's public page: /impact/12-demo-at-central-library. */
export function impactPath(e: { id: number; name: string }): string {
  const slug = slugify(e.name);
  return `/impact/${e.id}${slug ? `-${slug}` : ""}`;
}

/** Where an event's public page is: impact events have their own, the rest are under their season. */
export function eventPath(e: { id: number; name: string; kind: string; season_year: number }): string {
  return e.kind === "outreach" ? impactPath(e) : `/seasons/${e.season_year}/events/${e.id}`;
}
