// Uploading one file to R2, as plain Worker code. worker.ts calls this
// directly for POST /admin/api/upload, before the request ever reaches
// Next.js: routing a request through Next costs more CPU than the upload
// itself, and the Workers Free plan allows 10 ms per request. (The Next.js
// route at the same path only runs under `next dev`.)
//
//   POST /admin/api/upload?filename=IMG_0042.jpg[&album_id=3][&alt=...][&width=4032&height=3024]
//   Content-Type: image/jpeg
//   body: the file itself
//
// The browser reads the photo's pixel size and sends it along, so the Worker
// doesn't have to read the photo back from R2 to find out.

import { slugify } from "./format";
import { ALLOWED_UPLOAD_TYPES, maxBytesFor } from "./media";

type UploadEnv = Pick<CloudflareEnv, "DB" | "MEDIA" | "IMAGES">;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

function dimension(raw: string | null): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : null;
}

export async function handleUpload(request: Request, env: UploadEnv, uploader: string): Promise<Response> {
  const url = new URL(request.url);
  const filename = (url.searchParams.get("filename") ?? "upload").slice(0, 200);
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const size = Number(request.headers.get("content-length"));

  if (!request.body) return json({ error: "No file was sent." }, 400);
  if (!ALLOWED_UPLOAD_TYPES.includes(type)) {
    return json({ error: `${filename}: only photos (JPG, PNG, WebP, HEIC, GIF, AVIF, SVG), videos (MP4, WebM, MOV) and PDFs can be uploaded.` }, 415);
  }
  if (!Number.isFinite(size) || size <= 0) return json({ error: "Missing file size." }, 411);
  const max = maxBytesFor(type);
  if (size > max) return json({ error: `${filename} is larger than ${Math.round(max / 1024 / 1024)} MB.` }, 413);

  const dot = filename.lastIndexOf(".");
  const base = slugify(dot > 0 ? filename.slice(0, dot) : filename).slice(0, 60);
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID().slice(0, 8)}-${base}${ext ? `.${ext}` : ""}`;

  const options: R2PutOptions = {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { uploadedBy: uploader, originalName: filename },
  };
  if (typeof FixedLengthStream !== "undefined") {
    // Stream straight into R2 without holding the file in memory. R2 needs to
    // know the length up front, which FixedLengthStream provides.
    const { readable, writable } = new FixedLengthStream(size);
    const piping = request.body.pipeTo(writable);
    await Promise.all([env.MEDIA.put(key, readable, options), piping]);
  } else {
    // `next dev` (Node) has no FixedLengthStream.
    await env.MEDIA.put(key, await request.arrayBuffer(), options);
  }

  // Pixel size, so pages can reserve space for the photo. Normally from the
  // browser; only when it couldn't tell (HEIC outside Safari) is the photo
  // read back from R2 for the Images binding to measure.
  let width = dimension(url.searchParams.get("width"));
  let height = dimension(url.searchParams.get("height"));
  if ((!width || !height) && type.startsWith("image/") && type !== "image/svg+xml" && env.IMAGES) {
    width = height = null;
    try {
      const stored = await env.MEDIA.get(key);
      if (stored) {
        const info = await env.IMAGES.info(stored.body);
        if ("width" in info) {
          width = info.width;
          height = info.height;
        }
      }
    } catch {
      // Not fatal: the image still works without dimensions.
    }
  }

  const albumId = Number(url.searchParams.get("album_id"));
  const inserted = await env.DB.prepare(
    `INSERT INTO media (r2_key, filename, content_type, size_bytes, alt, uploaded_by, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(key, filename, type, size, (url.searchParams.get("alt") ?? "").slice(0, 300), uploader, width, height)
    .first<{ id: number }>();
  if (!inserted) return json({ error: "Saved the file but couldn't record it." }, 500);

  if (Number.isInteger(albumId) && albumId > 0) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO album_photos (album_id, media_id, sort_order)
       VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM album_photos WHERE album_id = ?))`,
    )
      .bind(albumId, inserted.id, albumId)
      .run();
  }

  return json({ media: { id: inserted.id, r2_key: key, filename, content_type: type } });
}
