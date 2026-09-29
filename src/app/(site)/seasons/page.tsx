import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { ShowMore } from "@/components/show-more";
import { Container, EmptyState, PageHeader } from "@/components/page-header";
import { all } from "@/lib/db";
import { getSeasons } from "@/lib/data";

export const metadata: Metadata = {
  title: "Seasons",
  description: "Every FRC season and robot from Team 1209, the RoboHornets.",
};

export default async function SeasonsPage() {
  const [seasons, robots] = await Promise.all([
    getSeasons(),
    all<{ season_year: number; name: string; photo_key: string | null }>(
      `SELECT r.season_year, r.name, m.r2_key AS photo_key FROM robots r
       LEFT JOIN media m ON m.id = r.photo_media_id ORDER BY r.season_year, (r.kind = 'competition') DESC, r.sort_order, r.id`,
    ),
  ]);
  const robotsByYear = new Map<number, typeof robots>();
  for (const r of robots) {
    robotsByYear.set(r.season_year, [...(robotsByYear.get(r.season_year) ?? []), r]);
  }

  return (
    <>
      <PageHeader
        label="Archive"
        title="Seasons"
        intro={<p>Every January brings a new game and a new robot. Here&apos;s every season we&apos;ve logged so far.</p>}
      />
      <Container className="py-16 md:py-24">
        {seasons.length === 0 ? (
          <EmptyState>No seasons yet.</EmptyState>
        ) : (
          <ShowMore
            noun="seasons"
            initial={6}
            className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            items={seasons.map((s) => {
              const seasonRobots = robotsByYear.get(s.year) ?? [];
              const photo = s.hero_key ?? seasonRobots.find((r) => r.photo_key)?.photo_key ?? null;
              return (
                <li key={s.year}>
                  <Link
                    href={`/seasons/${s.year}`}
                    className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-panel hover:border-edge"
                  >
                    <div className="relative h-56">
                      <MediaImage mediaKey={photo} alt="" className="size-full" />
                      {s.is_current === 1 && (
                        <span className="absolute top-4 left-4 rounded bg-rust px-2 py-1 font-label text-xs text-white">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="flex grow flex-col gap-2 p-6">
                      <div className="flex items-baseline gap-3">
                        <span className="font-display text-6xl leading-none font-black">{s.year}</span>
                        <span className="font-display text-2xl font-bold text-hornet uppercase">{s.game_name || "TBA"}</span>
                      </div>
                      <p className="text-sand">
                        {seasonRobots.length > 0 ? seasonRobots.map((r) => r.name).join(" · ") : "Robot details coming soon"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          />
        )}
      </Container>
    </>
  );
}
