/**
 * Media files live once, as uploaded, in the R2 bucket. Pages ask for a width
 * (`/media/<key>?w=640`) and the media route resizes and re-encodes the
 * original on the fly with Cloudflare Images, caching the result. Nothing but
 * the original is ever stored.
 */

/** The only widths we resize to. Keeping this list short caps the number of
 * unique transformations per image (the Images free plan allows 5,000/month). */
export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const TRANSFORMABLE_EXT = /\.(jpe?g|png|webp|avif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

export function isTransformable(key: string | null | undefined): boolean {
  return Boolean(key && TRANSFORMABLE_EXT.test(key));
}

export function isVideo(key: string | null | undefined): boolean {
  return Boolean(key && VIDEO_EXT.test(key));
}

function path(key: string) {
  return `/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** URL of the untouched original file. */
export function originalUrl(key: string | null | undefined): string | null {
  return key ? path(key) : null;
}

/** Same, but tells the browser to save it with its original filename. */
export function downloadUrl(key: string | null | undefined): string | null {
  return key ? `${path(key)}?download=1` : null;
}

/**
 * Where a document button (Strategic Plan, engineering notebook) should go:
 * the uploaded PDF if there is one, otherwise the pasted link.
 */
export function documentLink(key: string | null | undefined, link: string | null | undefined): { href: string; external: boolean } | null {
  if (key) return { href: downloadUrl(key)!, external: false };
  if (link) return { href: link, external: true };
  return null;
}

/**
 * URL for displaying a file. Images get a resized copy at the nearest allowed
 * width; everything else (SVG, GIF, video, PDF) is served as the original.
 */
export function mediaUrl(key: string | null | undefined, width?: number): string | null {
  if (!key) return null;
  if (!width || !isTransformable(key)) return path(key);
  const w = IMAGE_WIDTHS.find((x) => x >= width) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
  return `${path(key)}?w=${w}`;
}

/** `srcset` for responsive images, up to `max` px wide. */
export function mediaSrcSet(key: string | null | undefined, max = 1920): string | undefined {
  if (!key || !isTransformable(key)) return undefined;
  return IMAGE_WIDTHS.filter((w) => w <= max)
    .map((w) => `${path(key)}?w=${w} ${w}w`)
    .join(", ");
}

export const IMAGE_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/svg+xml",
];
export const VIDEO_UPLOAD_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const ALLOWED_UPLOAD_TYPES = [...IMAGE_UPLOAD_TYPES, ...VIDEO_UPLOAD_TYPES, "application/pdf"];

/** Cloudflare Images can only transform inputs up to 20 MB. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Through the Worker: request bodies are capped at 100 MB on the Free and Pro plans. */
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
/** PDFs, e.g. engineering notebooks full of photos. */
export const MAX_OTHER_BYTES = 95 * 1024 * 1024;
/** Straight from the browser to R2 (src/lib/direct-upload.ts) there's no body cap. */
export const MAX_DIRECT_VIDEO_BYTES = 1024 * 1024 * 1024;
export const MAX_DIRECT_OTHER_BYTES = 500 * 1024 * 1024;

/** The largest file of this type that can be uploaded, directly to R2 or through the Worker. */
export function maxBytesFor(type: string, direct = false): number {
  if (type.startsWith("image/")) return MAX_IMAGE_BYTES;
  if (VIDEO_UPLOAD_TYPES.includes(type)) return direct ? MAX_DIRECT_VIDEO_BYTES : MAX_VIDEO_BYTES;
  return direct ? MAX_DIRECT_OTHER_BYTES : MAX_OTHER_BYTES;
}

/** "95 MB", "1 GB" */
export function formatLimit(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${Math.round(bytes / 1024 ** 3)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}
