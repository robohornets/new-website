import { getEnv } from "@/lib/cf";
import { IMAGE_WIDTHS, isTransformable, type ImageWidth } from "@/lib/media";

// Serves files from the R2 media bucket.
//   /media/<key>             the original, byte for byte
//   /media/<key>?download=1  the original as a download with its upload filename
//   /media/<key>?w=640       an image resized to one of IMAGE_WIDTHS by Cloudflare
//                            Images, re-encoded as WebP (or JPEG/PNG for old
//                            browsers) and cached at the edge. Not stored in R2.
// Keys are generated at upload and never reused, so everything is immutable.

const IMMUTABLE = "public, max-age=31536000, immutable";
// Uploaded SVGs and PDFs must never run script on our origin.
const SANDBOX = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; media-src 'self'; sandbox";

export async function GET(request: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const width = Number(url.searchParams.get("w"));
  const env = await getEnv();

  if (width && isTransformable(key) && env.IMAGES) {
    const resized = await transformed(request, env, key, width);
    if (resized) return resized;
    // Fall through to the original if the transform failed (for example the
    // free plan's monthly transformation allowance ran out).
  }

  const object = await env.MEDIA.get(key, { onlyIf: request.headers, range: request.headers });
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", IMMUTABLE);
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", SANDBOX);
  if (url.searchParams.has("download")) {
    const name = object.customMetadata?.originalName || key.split("/").pop() || "download";
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }

  if (!("body" in object) || !object.body) {
    return new Response(null, { status: 304, headers });
  }
  if (request.headers.has("range") && object.range && "offset" in object.range && object.range.offset !== undefined) {
    const end = object.range.offset + (object.range.length ?? object.size - object.range.offset) - 1;
    headers.set("content-range", `bytes ${object.range.offset}-${end}/${object.size}`);
    headers.set("content-length", String(end - object.range.offset + 1));
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { status: 200, headers });
}

async function transformed(request: Request, env: CloudflareEnv, key: string, requested: number): Promise<Response | null> {
  const width: ImageWidth = IMAGE_WIDTHS.find((w) => w >= requested) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
  const accept = request.headers.get("accept") ?? "";
  const isPng = /\.png$/i.test(key);
  // WebP everywhere it's supported (it keeps transparency); otherwise JPEG, or PNG for PNG sources.
  const format = /image\/webp/.test(accept) ? "image/webp" : isPng ? "image/png" : "image/jpeg";

  // The Workers Cache API is only there on Cloudflare (not under `next dev`).
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null;
  const cacheKey = new Request(`${new URL(request.url).origin}/media/${key}?w=${width}&f=${format.slice(6)}`);
  const hit = await cache?.match(cacheKey);
  if (hit) return hit;

  // OpenNext declares IMAGES as optional; it is bound in wrangler.jsonc.
  const images = env.IMAGES;
  if (!images) return null;
  const object = await env.MEDIA.get(key);
  if (!object) return null;
  try {
    const result = await images.input(object.body)
      .transform({ width, fit: "scale-down" })
      .output({ format, quality: 82 });
    const response = result.response();
    const headers = new Headers(response.headers);
    headers.set("cache-control", IMMUTABLE);
    headers.set("vary", "Accept");
    headers.set("x-content-type-options", "nosniff");
    const out = new Response(response.body, { status: 200, headers });
    if (cache) await cache.put(cacheKey, out.clone());
    return out;
  } catch (e) {
    console.warn("image transform failed", key, width, e);
    return null;
  }
}
