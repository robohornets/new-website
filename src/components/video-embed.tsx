/** The YouTube video id in a watch, youtu.be, shorts or embed link. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, "https://example.com");
    if (/(^|\.)youtu\.be$/.test(u.hostname)) return u.pathname.slice(1) || null;
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]+)/);
      return m?.[2] ?? null;
    }
  } catch {
    // not a URL
  }
  return null;
}

/** Plays a YouTube link or an uploaded video; anything else becomes a link. */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const yt = youtubeId(url);
  if (yt) {
    return (
      <div className="aspect-video overflow-hidden rounded-md border border-line bg-panel">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`}
          title={title}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }
  if (/^\/media\//.test(url) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    return <video src={url} controls preload="metadata" playsInline className="w-full rounded-md border border-line bg-panel" title={title} />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-hornet hover:text-hornet-hover">
      Watch the video
    </a>
  );
}
