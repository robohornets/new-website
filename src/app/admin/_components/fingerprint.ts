// Fingerprints the browser works out before uploading, so the same photo
// isn't stored twice (see migrations/0015_media_fingerprints.sql).

/** Files bigger than this are hashed from their first and last 8 MB (plus the size) instead of all of it. */
const WHOLE_FILE = 200 * 1024 * 1024;
const SAMPLE = 8 * 1024 * 1024;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** SHA-256 of the file, the same for byte-for-byte copies. "s:…" when it was sampled. */
export async function fileSha256(file: Blob): Promise<string | null> {
  if (!crypto?.subtle) return null;
  try {
    if (file.size <= WHOLE_FILE) return hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
    const parts = new Blob([file.slice(0, SAMPLE), file.slice(file.size - SAMPLE), String(file.size)]);
    return `s:${hex(await crypto.subtle.digest("SHA-256", await parts.arrayBuffer()))}`;
  } catch {
    return null;
  }
}

/**
 * A 64-bit "difference hash" of what a photo looks like: shrink it to 9×8
 * grey squares and note, square by square, whether each is brighter than
 * the one to its right. Resizing, recompressing or a messaging app's
 * re-save hardly change it. Then 6 more hex digits: its average colour, so
 * two different pictures with the same layout (a slide in red and in
 * blue) don't count as the same. '' when this browser can't open the photo
 * (HEIC outside Safari) or it's one flat colour; null when it isn't a photo.
 */
export async function photoHash(source: Blob, type: string): Promise<string | null> {
  if (!type.startsWith("image/") || type === "image/svg+xml") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return "";
  }
  try {
    // Shrink in one smoothed step to at most 128px wide, then average down
    // to 9×8 by hand, so every browser (and a thumbnail or the original)
    // ends up with the same squares.
    const scale = Math.min(1, 128 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(9, Math.round(bitmap.width * scale));
    const h = Math.max(8, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const grey = new Float64Array(9 * 8);
    const count = new Float64Array(9 * 8);
    const rgb = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      const gy = Math.min(7, Math.floor((y * 8) / h));
      for (let x = 0; x < w; x++) {
        const gx = Math.min(8, Math.floor((x * 9) / w));
        const i = (y * w + x) * 4;
        grey[gy * 9 + gx] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        count[gy * 9 + gx]++;
        rgb[0] += data[i];
        rgb[1] += data[i + 1];
        rgb[2] += data[i + 2];
      }
    }
    // A photo of one flat colour has no pattern to compare.
    const squares = [...grey].map((g, i) => g / count[i]);
    if (Math.max(...squares) - Math.min(...squares) < 4) return "";
    let bits = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = grey[y * 9 + x] / count[y * 9 + x];
        const right = grey[y * 9 + x + 1] / count[y * 9 + x + 1];
        bits += left > right ? "1" : "0";
      }
    }
    let out = "";
    for (let i = 0; i < 64; i += 4) out += parseInt(bits.slice(i, i + 4), 2).toString(16);
    for (const c of rgb) out += Math.round(c / (w * h)).toString(16).padStart(2, "0");
    return out;
  } catch {
    return "";
  } finally {
    bitmap.close();
  }
}

/** The photo hash of a file already in the library, from its small preview. '' if it can't be read. */
export async function fingerprintStored(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const blob = await res.blob();
    return (await photoHash(blob, blob.type || "image/jpeg")) ?? "";
  } catch {
    return "";
  }
}
