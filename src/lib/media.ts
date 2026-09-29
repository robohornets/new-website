/** Public URL for a file in the R2 media bucket (served by app/media/[...key]). */
export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
