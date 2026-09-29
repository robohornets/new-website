import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { getEnv } from "@/lib/cf";
import { first, run } from "@/lib/db";
import { slugify } from "@/lib/format";
import { ALLOWED_UPLOAD_TYPES, maxBytesFor } from "@/lib/media";

// Uploads one file to R2, exactly as the user sent it, and records it in the
// media table. The request body is the raw file; details go in the query:
//   POST /admin/api/upload?filename=IMG_0042.jpg[&album_id=3][&alt=...]
//   Content-Type: image/jpeg
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const url = new URL(request.url);
  const filename = (url.searchParams.get("filename") ?? "upload").slice(0, 200);
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const size = Number(request.headers.get("content-length"));

  if (!request.body) return Response.json({ error: "No file was sent." }, { status: 400 });
  if (!ALLOWED_UPLOAD_TYPES.includes(type)) {
    return Response.json(
      { error: `${filename}: only photos (JPG, PNG, WebP, HEIC, GIF, AVIF, SVG), videos (MP4, WebM, MOV) and PDFs can be uploaded.` },
      { status: 415 },
    );
  }
  if (!Number.isFinite(size) || size <= 0) return Response.json({ error: "Missing file size." }, { status: 411 });
  const max = maxBytesFor(type);
  if (size > max) {
    return Response.json({ error: `${filename} is larger than ${Math.round(max / 1024 / 1024)} MB.` }, { status: 413 });
  }

  const dot = filename.lastIndexOf(".");
  const base = slugify(dot > 0 ? filename.slice(0, dot) : filename).slice(0, 60);
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID().slice(0, 8)}-${base}${ext ? `.${ext}` : ""}`;

  const env = await getEnv();
  const options: R2PutOptions = {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { uploadedBy: user.email, originalName: filename },
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

  // Read the pixel size (free with the Images binding) so pages can reserve space.
  let width: number | null = null;
  let height: number | null = null;
  if (type.startsWith("image/") && type !== "image/svg+xml" && env.IMAGES) {
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

  const inserted = await first<{ id: number }>(
    `INSERT INTO media (r2_key, filename, content_type, size_bytes, alt, uploaded_by, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    key,
    filename,
    type,
    size,
    (url.searchParams.get("alt") ?? "").slice(0, 300),
    user.email,
    width,
    height,
  );
  if (!inserted) return Response.json({ error: "Saved the file but couldn't record it." }, { status: 500 });

  const albumId = Number(url.searchParams.get("album_id"));
  if (Number.isInteger(albumId) && albumId > 0) {
    await run(
      `INSERT OR IGNORE INTO album_photos (album_id, media_id, sort_order)
       VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM album_photos WHERE album_id = ?))`,
      albumId,
      inserted.id,
      albumId,
    );
  }

  return Response.json({ media: { id: inserted.id, r2_key: key, filename, content_type: type } });
}
