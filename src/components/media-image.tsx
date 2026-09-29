import { mediaUrl } from "@/lib/media";

type Props = {
  mediaKey: string | null | undefined;
  alt: string;
  className?: string;
  /** Shown in the striped placeholder when there's no image yet. */
  placeholder?: string;
  loading?: "lazy" | "eager";
};

/**
 * An image from the R2 media bucket, or a striped placeholder box when the
 * admin hasn't uploaded one yet.
 */
export function MediaImage({ mediaKey, alt, className = "", placeholder, loading = "lazy" }: Props) {
  const src = mediaUrl(mediaKey);
  if (!src) {
    return (
      <div className={`hatch flex items-center justify-center ${className}`} role="img" aria-label={alt}>
        {placeholder ? <span className="px-4 text-center font-mono text-xs text-ash">{placeholder}</span> : null}
      </div>
    );
  }
  // R2 images are already sized by the uploader; next/image optimisation would
  // need the paid Images binding, so a plain <img> is used on purpose.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={loading} decoding="async" className={`object-cover ${className}`} />;
}
