import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { SeasonSwitcher } from "@/components/season-switcher";
import { Container, EmptyState, PageHeader } from "@/components/page-header";
import { getAlbums } from "@/lib/data";
import { all } from "@/lib/db";
import { seasonLabel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photos from RoboHornets build seasons, competitions and impact events.",
};

export default async function GalleryPage(props: PageProps<"/gallery">) {
  const { season: seasonParam } = await props.searchParams;
  const season = Number(Array.isArray(seasonParam) ? seasonParam[0] : seasonParam) || undefined;
  const [albums, withAlbums] = await Promise.all([
    getAlbums(season),
    all<{ year: number }>("SELECT DISTINCT season_year AS year FROM albums WHERE published = 1 AND season_year IS NOT NULL"),
  ]);
  // Only years that have albums, so every filter button shows something.
  const yearsWithAlbums = withAlbums.map((r) => r.year);

  return (
    <>
      <PageHeader label="Photos" title="Gallery" intro={<p>Build nights, competition days and everything in between.</p>}>
        {yearsWithAlbums.length > 0 && (
          <nav aria-label="Filter by season" className="pt-2">
            <SeasonSwitcher years={yearsWithAlbums} current={season ?? null} href="/gallery?season={year}" variant="pill" all={{ label: "All", href: "/gallery" }} />
          </nav>
        )}
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
                  <div className="flex items-center gap-2.5 font-label text-xs tracking-wider text-dust uppercase">
                    {a.season_year && <span className="text-hornet">{seasonLabel(a.season_year)}</span>}
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
