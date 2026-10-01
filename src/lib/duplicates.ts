import "server-only";
import { all, first } from "./db";
import { getMediaUsage, type MediaUse } from "./media-usage";
import { sameShape, samePhoto } from "./phash";

// Groups of files in the media library that are the same: byte-for-byte
// copies (same sha256) or photos that look the same (close phash). See
// migrations/0015_media_fingerprints.sql.

export type DuplicateFile = {
  id: number;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
  uses: MediaUse[];
};

export type DuplicateGroup = {
  files: DuplicateFile[];
  /** Every file in it is the very same file (rather than copies that look alike). */
  exact: boolean;
  /** The one to keep unless someone picks another: the most used, then the biggest picture, then the oldest. */
  keep: number;
};

/** How many photos haven't had their look fingerprinted yet (uploaded before duplicate checks). */
export async function countUnhashed(): Promise<number> {
  const row = await first<{ n: number }>("SELECT COUNT(*) AS n FROM media WHERE phash IS NULL AND content_type LIKE 'image/%' AND content_type != 'image/svg+xml'");
  return row?.n ?? 0;
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  const [exactRows, pairs, distinct] = await Promise.all([
    all<{ ids: string }>("SELECT group_concat(id) AS ids FROM media WHERE sha256 IS NOT NULL GROUP BY sha256 HAVING COUNT(*) > 1"),
    // Candidate pairs share a quarter of their pattern exactly (each join uses its index).
    all<{ a: number; b: number; pa: string; pb: string; wa: number | null; ha: number | null; wb: number | null; hb: number | null }>(
      [1, 5, 9, 13]
        .map(
          (at) => `SELECT x.id AS a, y.id AS b, x.phash AS pa, y.phash AS pb, x.width AS wa, x.height AS ha, y.width AS wb, y.height AS hb
             FROM media x JOIN media y ON substr(y.phash, ${at}, 4) = substr(x.phash, ${at}, 4) AND y.id > x.id
             WHERE x.phash != '' AND y.phash != ''`,
        )
        .join(" UNION "),
    ),
    all<{ a: number; b: number }>("SELECT a, b FROM media_distinct"),
  ]);

  // Union-find over every pair that's the same.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let p = parent.get(x) ?? x;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };
  const seen = new Set<number>();
  const join = (a: number, b: number) => {
    seen.add(a);
    seen.add(b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
  };
  const notSame = new Set(distinct.map((d) => `${d.a}-${d.b}`));
  const exactPairs = new Set<string>();
  for (const row of exactRows) {
    const ids = row.ids.split(",").map(Number).sort((x, y) => x - y);
    for (let i = 1; i < ids.length; i++) {
      if (notSame.has(`${ids[0]}-${ids[i]}`)) continue;
      join(ids[0], ids[i]);
      exactPairs.add(`${ids[0]}-${ids[i]}`);
    }
  }
  const near = new Set<number>();
  for (const p of pairs) {
    if (notSame.has(`${p.a}-${p.b}`)) continue;
    if (!samePhoto(p.pa, p.pb) || !sameShape({ width: p.wa, height: p.ha }, { width: p.wb, height: p.hb })) continue;
    join(p.a, p.b);
    near.add(p.a);
    near.add(p.b);
  }

  const groups = new Map<number, number[]>();
  for (const id of seen) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }
  const ids = [...seen];
  if (!ids.length) return [];

  const [files, usage] = await Promise.all([
    all<Omit<DuplicateFile, "uses">>(
      `SELECT id, r2_key, filename, content_type, size_bytes, width, height, created_at FROM media WHERE id IN (SELECT value FROM json_each(?))`,
      JSON.stringify(ids),
    ),
    getMediaUsage(ids),
  ]);
  const byId = new Map(files.map((f) => [f.id, { ...f, uses: usage.get(f.id) ?? [] }]));

  const out: DuplicateGroup[] = [];
  for (const members of groups.values()) {
    const list = members.map((id) => byId.get(id)).filter((f): f is DuplicateFile => Boolean(f));
    if (list.length < 2) continue;
    const ranked = [...list].sort(
      (a, b) =>
        b.uses.length - a.uses.length ||
        (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id - b.id,
    );
    out.push({ files: list.sort((a, b) => a.id - b.id), exact: !list.some((f) => near.has(f.id)), keep: ranked[0].id });
  }
  // Biggest groups first.
  return out.sort((a, b) => b.files.length - a.files.length || a.keep - b.keep);
}

/** Photos still to be fingerprinted, a batch at a time, for the browser to work out. */
export async function unhashedBatch(limit = 40): Promise<{ id: number; r2_key: string }[]> {
  return all<{ id: number; r2_key: string }>(
    "SELECT id, r2_key FROM media WHERE phash IS NULL AND content_type LIKE 'image/%' AND content_type != 'image/svg+xml' ORDER BY id LIMIT ?",
    limit,
  );
}
