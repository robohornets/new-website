import { mediaSrcSet, mediaUrl } from "@/lib/media";

type Props = {
  mediaKey: string | null | undefined;
  alt: string;
  className?: string;
  /** Shown in the striped placeholder when there's no image yet. */
  placeholder?: string;
  loading?: "lazy" | "eager";
  /** How wide the image is on screen, for picking a size from srcset. */
  sizes?: string;
  /** Largest width to ask for. */
  maxWidth?: number;
};

/**
 * An image from the R2 media bucket, or a striped placeholder box when the
 * admin hasn't uploaded one yet.
 */
export function MediaImage({
  mediaKey,
  alt,
  className = "",
  placeholder,
  loading = "lazy",
  sizes = "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw",
  maxWidth = 1920,
}: Props) {
  const src = mediaUrl(mediaKey, Math.min(960, maxWidth));
  if (!src) {
    return (
      <div className={`hatch flex items-center justify-center ${className}`} role="img" aria-label={alt}>
        {placeholder ? <span className="px-4 text-center font-mono text-xs text-ash">{placeholder}</span> : null}
      </div>
    );
  }
  // Resized copies come from our own /media route (Cloudflare Images on an R2
  // original), so next/image isn't needed.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={mediaSrcSet(mediaKey, maxWidth)}
      sizes={sizes}
      alt={alt}
      loading={loading}
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
}
