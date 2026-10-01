"use server";

import { requireAdmin } from "@/lib/auth";
import { all, first } from "@/lib/db";
import { hamming, quarters, sameShape, samePhoto } from "@/lib/phash";

export type DuplicateMatch = {
  id: number;
  r2_key: string;
  filename: string;
  content_type: string;
  width: number | null;
  height: number | null;
  /** The very same file, rather than a copy that looks the same. */
  exact: boolean;
};

type Candidate = Omit<DuplicateMatch, "exact"> & { phash: string | null; sha256: string | null };

/**
 * A file already in the library that's the same as the one about to be
 * uploaded: the same bytes, or (for photos) one that looks the same, like a
 * resized or re-saved copy. Null when there's none.
 */
export async function findDuplicate(fp: {
  sha256: string | null;
  phash: string | null;
  width?: number | null;
  height?: number | null;
}): Promise<DuplicateMatch | null> {
  await requireAdmin();
  const cols = "id, r2_key, filename, content_type, width, height, phash, sha256";
  if (fp.sha256) {
    const same = await first<Candidate>(`SELECT ${cols} FROM media WHERE sha256 = ? ORDER BY id LIMIT 1`, fp.sha256);
    if (same) return { ...strip(same), exact: true };
  }
  if (fp.phash && fp.phash.length === 22) {
    const q = quarters(fp.phash);
    const near = await all<Candidate>(
      `SELECT ${cols} FROM media WHERE phash != '' AND (substr(phash, 1, 4) = ? OR substr(phash, 5, 4) = ? OR substr(phash, 9, 4) = ? OR substr(phash, 13, 4) = ?)
       ORDER BY id LIMIT 200`,
      ...q,
    );
    const size = { width: fp.width ?? null, height: fp.height ?? null };
    const hit = near
      .filter((c) => c.phash && samePhoto(c.phash, fp.phash!) && sameShape(c, size))
      .sort((a, b) => hamming(a.phash!, fp.phash!) - hamming(b.phash!, fp.phash!))[0];
    if (hit) return { ...strip(hit), exact: false };
  }
  return null;
}

function strip(c: Candidate): Omit<DuplicateMatch, "exact"> {
  return { id: c.id, r2_key: c.r2_key, filename: c.filename, content_type: c.content_type, width: c.width, height: c.height };
}
