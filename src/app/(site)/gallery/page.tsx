import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { Container, EmptyState, PageHeader } from "@/components/page-header";
import { getAlbums, getSeasons } from "@/lib/data";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photos from RoboHornets build seasons, competitions and outreach events.",
};

export default async function GalleryPage(props: PageProps<"/gallery">) {
  const { season: seasonParam } = await props.searchParams;
  const season = Number(Array.isArray(seasonParam) ? seasonParam[0] : seasonParam) || undefined;
  const [albums, seasons] = await Promise.all([getAlbums(season), getSeasons()]);
  const yearsWithAlbums = seasons.map((s) => s.year);

  return (
    <>
      <PageHeader label="Photos" title="Gallery" intro={<p>Build nights, competition days and everything in between.</p>}>
        <nav aria-label="Filter by season" className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/gallery"
            aria-current={!season ? "page" : undefined}
            className={`flex h-11 items-center rounded-full px-5 text-sm font-semibold ${
              !season ? "bg-bone text-ink" : "border border-line-strong text-sand hover:border-bone"
            }`}
          >
            All
          </Link>
          {yearsWithAlbums.map((y) => (
            <Link
              key={y}
              href={`/gallery?season=${y}`}
              aria-current={season === y ? "page" : undefined}
              className={`flex h-11 items-center rounded-full px-5 font-mono text-sm ${
                season === y ? "bg-bone font-bold text-ink" : "border border-line-strong text-sand hover:border-bone"
              }`}
            >
              {y}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <Container className="py-16 md:py-24">
        {albums.length === 0 ? (
          <EmptyState>No albums {season ? `from ${season} ` : ""}yet.</EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {albums.map((a) => (
              <li key={a.id}>
                <Link href={`/gallery/${a.slug}`} className="group flex flex-col gap-4">
                  <div className="h-64 overflow-hidden rounded-md">
                    <MediaImage
                      mediaKey={a.cover_key}
                      alt=""
                      className="size-full transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex items-center gap-2.5 font-mono text-xs tracking-wider text-dust uppercase">
                    {a.season_year && <span className="text-hornet">{a.season_year}</span>}
                    <span>{a.photo_count} photos</span>
                  </div>
                  <h2 className="font-display text-3xl leading-none font-bold uppercase group-hover:text-hornet">{a.title}</h2>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
