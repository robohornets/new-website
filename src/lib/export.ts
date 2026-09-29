import "server-only";
import { all } from "./db";
import { originalUrl } from "./media";

/**
 * Every content table, in an order that respects foreign keys, so the export
 * can be loaded back table by table. Columns listed in `omit` are left out.
 */
export const EXPORT_TABLES: { name: string; label: string; omit?: string[] }[] = [
  { name: "media", label: "Media files" },
  { name: "site_settings", label: "Site text & links" },
  { name: "seasons", label: "Seasons" },
  { name: "robots", label: "Robots" },
  { name: "events", label: "Events & results" },
  { name: "matches", label: "Matches" },
  { name: "people", label: "People" },
  { name: "roster_entries", label: "Roster (per season)" },
  { name: "subteams", label: "Subteams" },
  { name: "roster_extra_subteams", label: "Roster extra subteams" },
  { name: "join_requests", label: "Join requests", omit: ["ip_hash"] },
  { name: "sponsor_tiers", label: "Sponsor tiers" },
  { name: "sponsors", label: "Sponsors" },
  { name: "sponsor_seasons", label: "Sponsor lineups (per season)" },
  { name: "posts", label: "News & outreach posts" },
  { name: "albums", label: "Gallery albums" },
  { name: "album_photos", label: "Album photos" },
  { name: "contacts", label: "Contact page people" },
  // The hashed IP is only for rate limiting and isn't useful anywhere else.
  { name: "messages", label: "Contact messages", omit: ["ip_hash"] },
  { name: "audit_log", label: "Admin change log" },
];

type Row = Record<string, unknown>;

export async function exportTable(name: string, origin: string): Promise<Row[]> {
  const table = EXPORT_TABLES.find((t) => t.name === name);
  if (!table) throw new Error(`Unknown table ${name}`);
  // Table names come from the fixed list above, never from the request.
  const rows = await all<Row>(`SELECT * FROM ${table.name}`);
  return rows.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) if (!table.omit?.includes(k)) out[k] = v;
    if (table.name === "media" && typeof row.r2_key === "string") {
      out.original_url = `${origin}${originalUrl(row.r2_key)}`;
    }
    return out;
  });
}

export async function buildExport(origin: string, exportedBy: string) {
  const [schema, migrations] = await Promise.all([
    all<{ type: string; name: string; sql: string }>(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'
       ORDER BY type = 'index', name`,
    ),
    all<{ name: string; applied_at: string }>("SELECT name, applied_at FROM d1_migrations ORDER BY id").catch(() => []),
  ]);
  const tables: Record<string, Row[]> = {};
  for (const t of EXPORT_TABLES) tables[t.name] = await exportTable(t.name, origin);
  return {
    format: "btwrobotics-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy,
    site: origin,
    notes:
      "All site content from the D1 database. Uploaded files are listed in tables.media with an original_url; download them from the admin's Export page or straight from the R2 bucket. Settings values are JSON strings.",
    migrations,
    schema,
    tables,
  };
}

export function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}
