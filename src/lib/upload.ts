// Uploading files to R2, as plain Worker code. worker.ts answers these
// requests itself, before they ever reach Next.js: sending a request through
// Next costs more CPU than storing the file, and the Workers Free plan
// allows 10 ms per request. (The Next.js routes at the same paths only run
// under `next dev`.)
//
// Two ways in:
//
// 1. Straight to R2 (when the R2 API keys are set up): the browser asks
//    POST /admin/api/upload/start for a signed upload address, PUTs the file
//    to R2 itself (the Worker never sees the bytes, so up to 1 GB), then
//    POST /admin/api/upload/finish records it.
// 2. Through the Worker (no R2 keys yet, or `next dev`):
//    POST /admin/api/upload?filename=IMG_0042.jpg[&album_id=3][&width=4032&height=3024]
//    with the file as the body, up to 95 MB.
//
// Either way the browser sends the picture's pixel size, so the Worker
// doesn't have to read the file back to measure it.

import { AwsClient } from "aws4fetch";
import { slugify } from "./format";
import { ALLOWED_UPLOAD_TYPES, formatLimit, maxBytesFor } from "./media";

type UploadEnv = Pick<CloudflareEnv, "DB" | "MEDIA" | "IMAGES"> & {
  R2_ACCOUNT_ID?: string;
  R2_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

const TYPES_MESSAGE = "only photos (JPG, PNG, WebP, HEIC, GIF, AVIF, SVG), videos (MP4, WebM, MOV) and PDFs can be uploaded.";

function dimension(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : null;
}

/** What's wrong with this file, or null if it can be uploaded. */
function refuse(filename: string, type: string, size: number, direct: boolean): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(type)) return `${filename}: ${TYPES_MESSAGE}`;
  if (!Number.isFinite(size) || size <= 0) return `${filename}: missing file size.`;
  const max = maxBytesFor(type, direct);
  if (size > max) return `${filename} is larger than ${formatLimit(max)}.`;
  return null;
}

function newKey(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const base = slugify(dot > 0 ? filename.slice(0, dot) : filename).slice(0, 60);
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const now = new Date();
  return `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID().slice(0, 8)}-${base}${ext ? `.${ext}` : ""}`;
}

type Details = {
  key: string;
  filename: string;
  type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  albumId: number;
  uploader: string;
  /** The browser's fingerprints of the file (see src/lib/fingerprint.ts). */
  sha256: string | null;
  phash: string | null;
};

const fingerprint = (raw: unknown, pattern: RegExp) => {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return pattern.test(v) ? v : null;
};
/** "abc…" (64 hex), or "s:abc…" for a big file hashed in samples. */
const sha = (raw: unknown) => fingerprint(raw, /^(s:)?[0-9a-f]{64}$/);
/** 22 hex digits (pattern and colour), or '' when the browser couldn't read the photo. */
const phash = (raw: unknown) => (raw === "" ? "" : fingerprint(raw, /^[0-9a-f]{22}$/));

/** Adds an uploaded file to the media table (and to an album). */
async function record(env: UploadEnv, d: Details): Promise<Response> {
  let { width, height } = d;
  // Only when the browser couldn't tell (HEIC outside Safari) is the photo
  // read back from R2 for the Images binding to measure.
  if ((!width || !height) && d.type.startsWith("image/") && d.type !== "image/svg+xml" && env.IMAGES) {
    width = height = null;
    try {
      const stored = await env.MEDIA.get(d.key);
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

  const inserted = await env.DB.prepare(
    `INSERT INTO media (r2_key, filename, content_type, size_bytes, alt, uploaded_by, width, height, sha256, phash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(d.key, d.filename, d.type, d.size, d.alt.slice(0, 300), d.uploader, width, height, d.sha256, d.phash)
    .first<{ id: number }>();
  if (!inserted) return json({ error: "Saved the file but couldn't record it." }, 500);

  if (Number.isInteger(d.albumId) && d.albumId > 0) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO album_photos (album_id, media_id, sort_order)
       VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM album_photos WHERE album_id = ?))`,
    )
      .bind(d.albumId, inserted.id, d.albumId)
      .run();
  }

  return json({ media: { id: inserted.id, r2_key: d.key, filename: d.filename, content_type: d.type } });
}

// ---- Through the Worker -------------------------------------------------------------

export async function handleUpload(request: Request, env: UploadEnv, uploader: string): Promise<Response> {
  const url = new URL(request.url);
  const filename = (url.searchParams.get("filename") ?? "upload").slice(0, 200);
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const size = Number(request.headers.get("content-length"));

  if (!request.body) return json({ error: "No file was sent." }, 400);
  const problem = refuse(filename, type, size, false);
  if (problem) return json({ error: problem }, ALLOWED_UPLOAD_TYPES.includes(type) ? 413 : 415);

  const key = newKey(filename);
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

  return record(env, {
    key,
    filename,
    type,
    size,
    width: dimension(url.searchParams.get("width")),
    height: dimension(url.searchParams.get("height")),
    alt: url.searchParams.get("alt") ?? "",
    albumId: Number(url.searchParams.get("album_id")),
    uploader,
    sha256: sha(url.searchParams.get("sha256")),
    phash: phash(url.searchParams.get("phash")),
  });
}

// ---- Straight to R2 ---------------------------------------------------------------------

/** Whether the R2 API keys for direct uploads are set up. */
export function directUploadsConfigured(env: UploadEnv): boolean {
  return Boolean(env.R2_ACCOUNT_ID?.trim() && env.R2_BUCKET_NAME?.trim() && env.R2_ACCESS_KEY_ID?.trim() && env.R2_SECRET_ACCESS_KEY?.trim());
}

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * A receipt for one upload, signed with the R2 secret, so /finish only
 * records the file /start handed out (not some other object in the bucket).
 */
async function receipt(env: UploadEnv, claim: { key: string; type: string; size: number; uploader: string; exp: number }) {
  const hmac = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.R2_SECRET_ACCESS_KEY!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", hmac, new TextEncoder().encode(JSON.stringify(claim))));
}

type StartBody = { filename?: unknown; type?: unknown; size?: unknown };
type FinishBody = StartBody & {
  key?: unknown;
  exp?: unknown;
  receipt?: unknown;
  width?: unknown;
  height?: unknown;
  album_id?: unknown;
  alt?: unknown;
  sha256?: unknown;
  phash?: unknown;
};

/** Signs an R2 upload address for one file, good for an hour. */
export async function startDirectUpload(request: Request, env: UploadEnv, uploader: string): Promise<Response> {
  if (!directUploadsConfigured(env)) return json({ direct: false }, 501);
  const body = (await request.json().catch(() => ({}))) as StartBody;
  const filename = String(body.filename ?? "upload").slice(0, 200);
  const type = String(body.type ?? "").toLowerCase();
  const size = Number(body.size);
  const problem = refuse(filename, type, size, true);
  if (problem) return json({ error: problem }, 400);

  const key = newKey(filename);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const r2 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID!.trim(), secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(), service: "s3", region: "auto" });
  const target = new URL(`https://${env.R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME!.trim()}/${key}`);
  target.searchParams.set("X-Amz-Expires", "3600");
  // Content-Type is signed too (allHeaders), so the file can only be stored as
  // the type checked above: the media route serves files with their stored
  // type, and an HTML "photo" must never be possible.
  const signed = await r2.sign(new Request(target, { method: "PUT", headers: { "content-type": type } }), { aws: { signQuery: true, allHeaders: true } });

  return json({ key, url: signed.url, exp, receipt: await receipt(env, { key, type, size, uploader, exp }) });
}

/** Records a file the browser has just put in R2. */
export async function finishDirectUpload(request: Request, env: UploadEnv, uploader: string): Promise<Response> {
  if (!directUploadsConfigured(env)) return json({ direct: false }, 501);
  const body = (await request.json().catch(() => ({}))) as FinishBody;
  const key = String(body.key ?? "");
  const type = String(body.type ?? "").toLowerCase();
  const size = Number(body.size);
  const exp = Number(body.exp);
  // An hour to upload, plus a little to finish.
  if (!key.startsWith("uploads/") || !(exp > Date.now() / 1000 - 600)) return json({ error: "That upload expired. Please try again." }, 400);
  if (body.receipt !== (await receipt(env, { key, type, size, uploader, exp }))) return json({ error: "That upload couldn't be verified." }, 403);

  const stored = await env.MEDIA.head(key);
  if (!stored) return json({ error: "The file didn't reach storage. Please try again." }, 400);
  if (stored.size !== size) {
    await env.MEDIA.delete(key);
    return json({ error: "The file arrived incomplete. Please try again." }, 400);
  }

  return record(env, {
    key,
    filename: String(body.filename ?? "upload").slice(0, 200),
    type,
    size,
    width: dimension(body.width),
    height: dimension(body.height),
    alt: String(body.alt ?? ""),
    albumId: Number(body.album_id),
    uploader,
    sha256: sha(body.sha256),
    phash: phash(body.phash),
  });
}

export const UPLOAD_PATHS = ["/admin/api/upload", "/admin/api/upload/start", "/admin/api/upload/finish"];

/** Sends an upload request to the right handler. */
export function routeUpload(request: Request, env: UploadEnv, uploader: string): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path.endsWith("/start")) return startDirectUpload(request, env, uploader);
  if (path.endsWith("/finish")) return finishDirectUpload(request, env, uploader);
  return handleUpload(request, env, uploader);
}
