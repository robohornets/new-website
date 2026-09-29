import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, EmptyState } from "@/components/page-header";
import { getAlbum, getAlbumPhotos } from "@/lib/data";
import { isVideo, mediaSrcSet, mediaUrl, originalUrl } from "@/lib/media";

export async function generateMetadata(props: PageProps<"/gallery/[slug]">): Promise<Metadata> {
  const album = await getAlbum((await props.params).slug);
  return album ? { title: album.title, description: album.description || undefined } : { title: "Album not found" };
}

export default async function AlbumPage(props: PageProps<"/gallery/[slug]">) {
  const album = await getAlbum((await props.params).slug);
  if (!album) notFound();
  const photos = await getAlbumPhotos(album.id);

  return (
    <>
      <Container className="flex flex-col gap-5 pt-12 pb-10 md:pt-20">
        <nav aria-label="Breadcrumb" className="font-label text-xs tracking-wider text-dust uppercase">
          <Link href="/gallery" className="hover:text-bone">
            Gallery
          </Link>
          {album.season_year && (
            <>
              <span className="px-2 text-ash">/</span>
              <Link href={`/gallery?season=${album.season_year}`} className="hover:text-bone">
                {album.season_year}
              </Link>
            </>
          )}
        </nav>
        <h1 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">{album.title}</h1>
        {album.description && <p className="max-w-2xl text-lg leading-relaxed text-sand">{album.description}</p>}
        <span className="font-label text-sm text-dust">{photos.length} photos</span>
      </Container>
      <Container className="pb-20">
        {photos.length === 0 ? (
          <EmptyState>No photos in this album yet.</EmptyState>
        ) : (
          <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {photos.map((p) => {
              const original = originalUrl(p.r2_key) ?? "";
              return (
                <li key={p.media_id} className="mb-4 break-inside-avoid">
                  <figure className="flex flex-col gap-2">
                    {isVideo(p.r2_key) ? (
                      <video src={original} controls preload="metadata" playsInline className="w-full rounded-md bg-panel">
                        <a href={original}>Download the video</a>
                      </video>
                    ) : (
                      // Opens a large 1920px copy rather than the (possibly huge) original.
                      <a href={mediaUrl(p.r2_key, 1920) ?? original} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mediaUrl(p.r2_key, 960) ?? original}
                          srcSet={mediaSrcSet(p.r2_key, 1280)}
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          width={p.width ?? undefined}
                          height={p.height ?? undefined}
                          alt={p.alt || p.caption || `Photo from ${album.title}`}
                          loading="lazy"
                          className="h-auto w-full"
                        />
                      </a>
                    )}
                    {p.caption && <figcaption className="text-sm text-dust">{p.caption}</figcaption>}
                  </figure>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </>
  );
}
