// Comparing photo fingerprints (see migrations/0015_media_fingerprints.sql).
// Pure functions, used by the browser and the server.

/** How many of the 64 pattern bits differ between two photo hashes. */
export function hamming(a: string, b: string): number {
  if (a.length < 16 || b.length < 16) return 64;
  let bits = 0;
  for (let i = 0; i < 16; i += 8) {
    let x = (parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)) >>> 0;
    while (x) {
      x &= x - 1;
      bits++;
    }
  }
  return bits;
}

/**
 * Up to this many differing bits counts as the same photo. Re-saved,
 * resized or texted copies are usually 0 to 3 apart; different photos are
 * usually 15 or more. Close shots from a burst can come in under it, which
 * is why the person always sees both and can upload theirs anyway.
 */
export const SAME_PHOTO = 5;

/** Their average colours (the last 6 digits) are close: each of red, green and blue within 24 of 255. */
export function sameColour(a: string, b: string): boolean {
  if (a.length !== 22 || b.length !== 22) return true;
  for (let i = 16; i < 22; i += 2) {
    if (Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) > 24) return false;
  }
  return true;
}

/** Whether two photo hashes are the same photo (pattern and colour). */
export function samePhoto(a: string, b: string): boolean {
  return hamming(a, b) <= SAME_PHOTO && sameColour(a, b);
}

/** The pattern's four 4-digit quarters, each indexed: near copies almost always share one exactly. */
export const quarters = (h: string) => [h.slice(0, 4), h.slice(4, 8), h.slice(8, 12), h.slice(12, 16)];

/** Same shape (within 2%), when both sizes are known. */
export function sameShape(a: { width: number | null; height: number | null }, b: { width: number | null; height: number | null }): boolean {
  if (!a.width || !a.height || !b.width || !b.height) return true;
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / Math.max(ra, rb) < 0.02;
}
