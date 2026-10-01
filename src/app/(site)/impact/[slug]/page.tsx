import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { impactWhen } from "@/components/impact-card";
import { MediaImage } from "@/components/media-image";
import { Container } from "@/components/page-header";
import { VideoEmbed } from "@/components/video-embed";
import { getAlbumPhotos } from "@/lib/data";
import { first } from "@/lib/db";
import { impactPath, seasonLabel } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { isVideo, mediaUrl } from "@/lib/media";
import { getPublicImpactEvent } from "@/lib/outreach";

/**
 * "12-demo-at-central-library" → event 12. Older links used a post's slug
 * ("impact-award", also from /news/…), which the post remembers the event of.
 */
async function eventId(slug: string): Promise<number | null> {
  const id = /^(\d+)(?:-|$)/.exec(slug)?.[1];
  if (id) return Number(id);
  const post = await first<{ event_id: number | null }>("SELECT event_id FROM posts WHERE slug = ?", slug).catch(() => null);
  return post?.event_id ?? null;
}

async function load(props: PageProps<"/impact/[slug]">) {
  const { slug } = await props.params;
  const id = await eventId(slug);
  const event = id ? await getPublicImpactEvent(id) : null;
  return { slug, event };
}

export async function generateMetadata(props: PageProps<"/impact/[slug]">): Promise<Metadata> {
  const { event } = await load(props);
  if (!event) return { title: "Not found" };
  const image = mediaUrl(event.cover_key, 1280);
  return {
    title: event.name,
    description: event.recap.slice(0, 200) || undefined,
    openGraph: { title: event.name, description: event.recap.slice(0, 200) || undefined, images: image ? [image] : undefined, type: "article" },
  };
}

export default async function ImpactEventPage(props: PageProps<"/impact/[slug]">) {
  const { slug, event } = await load(props);
  if (!event) notFound();
  // One address per event, renamed or not.
  const canonical = impactPath(event);
  if (`/impact/${slug}` !== canonical) permanentRedirect(canonical);

  const story = event.has_story === 1 ? renderMarkdown(event.story) : null;
  const photos = event.album_id ? await getAlbumPhotos(event.album_id) : [];
  const facts = [impactWhen(event), event.location, event.people_reached ? `${event.people_reached.toLocaleString("en-US")} people reached` : ""].filter(Boolean);

  return (
    <article>
      <Container size="narrow" className="flex flex-col gap-6 pt-12 pb-10 md:pt-20">
        <nav aria-label="Breadcrumb" className="font-label text-xs tracking-wider text-dust uppercase">
          <Link href="/impact" className="hover:text-bone">
            Impact
          </Link>
          <span className="px-2 text-ash">/</span>
          <Link href={`/seasons/${event.season_year}`} className="hover:text-bone">
            {seasonLabel(event.season_year)} season
          </Link>
        </nav>
        <h1 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">{event.name}</h1>
        <p className="font-label text-sm text-dust">{facts.join(" · ")}</p>
        {event.recap && <p className="text-xl leading-relaxed whitespace-pre-line text-sand">{event.recap}</p>}
      </Container>
      {event.cover_key && (
        <Container size="article" className="pb-10">
          <MediaImage mediaKey={event.cover_key} alt="" className="max-h-[640px] w-full rounded-md" loading="eager" sizes="(min-width: 1200px) 1200px, 100vw" />
        </Container>
      )}
      {event.highlight_video_url && (
        <Container size="article" className="pb-10">
          <VideoEmbed url={event.highlight_video_url} title={`${event.name} video`} />
        </Container>
      )}
      {story && (
        <Container size="text" className="pb-16 md:pb-20">
          {/* Markdown is rendered with raw HTML disabled; see lib/markdown.ts. */}
          <div className="prose-hive" dangerouslySetInnerHTML={{ __html: story }} />
        </Container>
      )}
      {/* Just the cover is already shown above. */}
      {photos.some((p) => p.r2_key !== event.cover_key) && (
        <section className="border-t border-line">
          <Container className="flex flex-col gap-8 py-16 md:py-20">
            <h2 className="font-display text-4xl font-extrabold uppercase">Photos</h2>
            <AlbumGrid
              title={event.name}
              items={photos.map((p) => ({
                id: p.media_id,
                mediaKey: p.r2_key,
                video: isVideo(p.r2_key),
                alt: p.alt,
                description: p.caption,
                width: p.width,
                height: p.height,
              }))}
            />
          </Container>
        </section>
      )}
    </article>
  );
}
