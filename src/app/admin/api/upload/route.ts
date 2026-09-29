import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { getEnv } from "@/lib/cf";
import { first, run } from "@/lib/db";
import { slugify } from "@/lib/format";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/media";

// Upload one file to R2 and record it in the media table.
// Optional `album_id` adds the photo to that gallery album.
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return Response.json({ error: `${file.name}: only JPG, PNG, WebP, GIF, AVIF, SVG and PDF files can be uploaded.` }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: `${file.name} is larger than 25 MB.` }, { status: 413 });
  }

  const dot = file.name.lastIndexOf(".");
  const base = slugify(dot > 0 ? file.name.slice(0, dot) : file.name).slice(0, 60);
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID().slice(0, 8)}-${base}${ext ? `.${ext}` : ""}`;

  const env = await getEnv();
  // R2 needs a body of known length; uploads are capped at 25 MB so buffering is fine.
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { uploadedBy: user.email, originalName: file.name },
  });

  const alt = String(form.get("alt") ?? "").slice(0, 300);
  const inserted = await first<{ id: number }>(
    `INSERT INTO media (r2_key, filename, content_type, size_bytes, alt, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    key,
    file.name.slice(0, 200),
    file.type,
    file.size,
    alt,
    user.email,
  );
  if (!inserted) return Response.json({ error: "Saved the file but couldn't record it." }, { status: 500 });

  const albumId = Number(form.get("album_id"));
  if (Number.isInteger(albumId) && albumId > 0) {
    await run(
      `INSERT OR IGNORE INTO album_photos (album_id, media_id, sort_order)
       VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM album_photos WHERE album_id = ?))`,
      albumId,
      inserted.id,
      albumId,
    );
  }

  return Response.json({ media: { id: inserted.id, r2_key: key, filename: file.name } });
}
