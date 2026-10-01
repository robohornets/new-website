import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { MediaImage } from "@/components/media-image";
import { Container } from "@/components/page-header";
import { getAlbumPhotos, getPost } from "@/lib/data";
import { formatDate, seasonLabel } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { isVideo, mediaUrl } from "@/lib/media";

export async function generateMetadata(props: PageProps<"/impact/[slug]">): Promise<Metadata> {
  const post = await getPost((await props.params).slug);
  if (!post) return { title: "Post not found" };
  const image = mediaUrl(post.cover_key, 1280);
  return {
    title: post.title,
    description: post.excerpt || undefined,
    openGraph: { title: post.title, description: post.excerpt || undefined, images: image ? [image] : undefined, type: "article" },
  };
}

export default async function PostPage(props: PageProps<"/impact/[slug]">) {
  const post = await getPost((await props.params).slug);
  if (!post) notFound();
  const html = renderMarkdown(post.body);
  const photos = post.album_id ? await getAlbumPhotos(post.album_id) : [];

  return (
    <article>
      <Container size="narrow" className="flex flex-col gap-6 pt-12 pb-10 md:pt-20">
        <nav aria-label="Breadcrumb" className="font-label text-xs tracking-wider text-dust uppercase">
          <Link href="/impact" className="hover:text-bone">
            Impact
          </Link>
          {post.season_year && (
            <>
              <span className="px-2 text-ash">/</span>
              <Link href={`/seasons/${post.season_year}`} className="hover:text-bone">
                {seasonLabel(post.season_year)} season
              </Link>
            </>
          )}
        </nav>
        <h1 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">{post.title}</h1>
        {post.published_at && (
          <time dateTime={post.published_at} className="font-label text-sm text-dust">
            {formatDate(post.published_at, { month: "long" })}
          </time>
        )}
        {post.excerpt && <p className="text-xl leading-relaxed text-sand">{post.excerpt}</p>}
      </Container>
      {post.cover_key && (
        <Container size="article" className="pb-10">
          <MediaImage mediaKey={post.cover_key} alt="" className="max-h-[640px] w-full rounded-md" loading="eager" sizes="(min-width: 1200px) 1200px, 100vw" />
        </Container>
      )}
      <Container size="text" className="pb-16 md:pb-20">
        {/* Markdown is rendered with raw HTML disabled; see lib/markdown.ts. */}
        <div className="prose-hive" dangerouslySetInnerHTML={{ __html: html }} />
      </Container>
      {/* Just the cover is already shown above. */}
      {photos.some((p) => p.r2_key !== post.cover_key) && (
        <section className="border-t border-line">
          <Container className="flex flex-col gap-8 py-16 md:py-20">
            <h2 className="font-display text-4xl font-extrabold uppercase">Photos</h2>
            <AlbumGrid
              title={post.title}
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
