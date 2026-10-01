import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { Container, EmptyState } from "@/components/page-header";
import { getAlbum, getAlbumPhotos } from "@/lib/data";
import { isVideo } from "@/lib/media";
import { seasonLabel } from "@/lib/format";

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
                {seasonLabel(album.season_year)}
              </Link>
            </>
          )}
        </nav>
        <h1 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">{album.title}</h1>
        {album.description && <p className="max-w-2xl text-lg leading-relaxed text-sand">{album.description}</p>}
        <span className="font-label text-sm text-dust">{photos.length} photos · click any photo to view it larger</span>
      </Container>
      <Container className="pb-20">
        {photos.length === 0 ? (
          <EmptyState>No photos in this album yet.</EmptyState>
        ) : (
          <AlbumGrid
            title={album.title}
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
        )}
      </Container>
    </>
  );
}
