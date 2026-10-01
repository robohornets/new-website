import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventRow } from "@/components/cards";
import { ArrowRight, Download, External } from "@/components/icons";
import { MediaImage } from "@/components/media-image";
import { Container, EmptyState } from "@/components/page-header";
import { RosterGrid } from "@/components/roster-grid";
import { SeasonSwitcher } from "@/components/season-switcher";
import { SponsorWall } from "@/components/sponsor-wall";
import {
  getAlbums,
  getEventMatchSummary,
  getEvents,
  getRobots,
  getRoster,
  getSeason,
  getSeasonPhotos,
  getSeasons,
  getSeasonSponsors,
  getSubteams,
} from "@/lib/data";
import { documentLink, mediaSrcSet, mediaUrl } from "@/lib/media";
import { SEASON_STATUS_LABEL } from "@/lib/types";

function parseYear(raw: string) {
  const year = Number(raw);
  return Number.isInteger(year) && year > 1990 && year < 3000 ? year : null;
}

export async function generateMetadata(props: PageProps<"/seasons/[year]">): Promise<Metadata> {
  const year = parseYear((await props.params).year);
  const season = year ? await getSeason(year) : null;
  if (!season) return { title: "Season not found" };
  return {
    title: `${season.year} ${season.game_name}`.trim(),
    description: `Team 1209's ${season.year} FRC season${season.game_name ? `, ${season.game_name}` : ""}: robot, competitions, roster and photos.`,
  };
}

export default async function SeasonPage(props: PageProps<"/seasons/[year]">) {
  const year = parseYear((await props.params).year);
  const season = year ? await getSeason(year) : null;
  if (!season) notFound();

  const [seasons, robots, events, roster, sponsors, photos, albums, subteams, matchSummary] = await Promise.all([
    getSeasons(),
    getRobots(season.year),
    getEvents(season.year),
    getRoster(season.year),
    getSeasonSponsors(season.year),
    getSeasonPhotos(season.year, 4),
    getAlbums(season.year),
    getSubteams(),
    getEventMatchSummary(season.year),
  ]);
  const [mainRobot, ...otherRobots] = robots;
  const students = roster.filter((m) => m.kind === "student");
  const mentors = roster.filter((m) => m.kind === "mentor");
  const heroKey = season.hero_key ?? mainRobot?.photo_key ?? null;
  const notebook = documentLink(season.notebook_key, season.notebook_url);
  const competitions = events.filter((e) => e.kind !== "outreach");
  const outreachEvents = events.filter((e) => e.kind === "outreach");

  return (
    <>
      {/* Year rail */}
      <nav aria-label="Seasons" className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-4 md:px-8 xl:px-16">
          <SeasonSwitcher years={seasons.map((s) => s.year)} current={season.year} href="/seasons/{year}" label="Season" variant="rail" />
        </div>
      </nav>

      {/* Hero */}
      <Container className="flex flex-col gap-10 py-12 md:py-18 lg:flex-row lg:gap-16">
        <div className="flex flex-col gap-7 lg:w-[520px] lg:shrink-0">
          <div className="flex items-center gap-2.5">
            {season.is_current === 1 && (
              <span className="rounded bg-rust px-2.5 py-1 font-label text-xs tracking-wider text-white">CURRENT SEASON</span>
            )}
            <span className="eyebrow text-dust">{SEASON_STATUS_LABEL[season.status]}</span>
          </div>
          <h1 className="flex flex-col font-display leading-[0.86] uppercase">
            <span className="text-[120px] font-black md:text-[168px]">{season.year}</span>
            <span className="text-6xl font-extrabold text-hornet md:text-8xl">{season.game_name || "TBA"}</span>
          </h1>
          {season.summary && <p className="text-lg leading-relaxed whitespace-pre-line text-sand">{season.summary}</p>}
          <div className="flex flex-wrap gap-3">
            {notebook && (
              <a
                href={notebook.href}
                {...(notebook.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex h-13 items-center gap-2 rounded-md bg-hornet px-5 font-bold text-ink hover:bg-hornet-hover"
              >
                Engineering notebook {notebook.external ? <External size={16} /> : <Download size={16} />}
              </a>
            )}
            {mainRobot?.code_url && (
              <a
                href={mainRobot.code_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-13 items-center gap-2 rounded-md border-[1.5px] border-edge px-5 font-semibold hover:border-bone"
              >
                Robot code on GitHub <External size={16} />
              </a>
            )}
            {season.reveal_video_url && (
              <a
                href={season.reveal_video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-13 items-center gap-2 rounded-md px-5 font-semibold text-hornet hover:text-hornet-hover"
              >
                Game reveal video <External size={16} />
              </a>
            )}
          </div>
        </div>
        <div className="relative h-[320px] grow overflow-hidden rounded-md border border-line md:h-[560px]">
          <MediaImage
            mediaKey={heroKey}
            alt={mainRobot ? `${mainRobot.name}, the ${season.year} robot` : `${season.year} season`}
            placeholder={mainRobot ? `${mainRobot.name} photo coming soon` : "Photo coming soon"}
            className="size-full"
            loading="eager"
          />
          {mainRobot && (
            <div className="absolute bottom-6 left-6 flex items-baseline gap-3.5 rounded-md border border-line-strong bg-ink px-5 py-4">
              <span className="eyebrow text-xs text-dust">Robot</span>
              <span className="font-display text-4xl leading-none font-black uppercase md:text-[44px]">{mainRobot.name}</span>
            </div>
          )}
        </div>
      </Container>

      {/* Specs + events */}
      <Container className="grid gap-6 pb-16 lg:grid-cols-2">
        <section className="flex flex-col gap-6 rounded-md border border-line bg-panel p-6 md:p-9">
          <h2 className="font-display text-4xl font-extrabold uppercase">{mainRobot ? `${mainRobot.name} specs` : "Robot specs"}</h2>
          {mainRobot?.description && <p className="leading-relaxed text-sand">{mainRobot.description}</p>}
          {mainRobot && mainRobot.specs.length > 0 ? (
            <dl>
              {mainRobot.specs.map((s) => (
                <div key={s.label} className="flex justify-between gap-6 border-b border-line py-4">
                  <dt className="font-label text-[13px] tracking-wider text-dust uppercase">{s.label}</dt>
                  <dd className="text-right font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-dust">Specs will be posted once the robot is built.</p>
          )}
        </section>
        <section id="events" className="flex flex-col gap-6 rounded-md border border-line bg-panel p-6 md:p-9">
          <h2 className="font-display text-4xl font-extrabold uppercase">Competitions</h2>
          {competitions.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {competitions.map((e) => (
                <EventRow key={e.id} event={e} matches={matchSummary.get(e.id) ?? { count: 0, ended: false }} />
              ))}
            </ul>
          ) : (
            <p className="text-dust">Events will be announced soon.</p>
          )}
          {competitions.length > 0 && <p className="text-sm text-dust">Open a competition for every match we played, with scores and videos.</p>}
          <a
            href={`https://www.thebluealliance.com/team/1209/${season.year}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex items-center gap-1.5 self-start text-sm text-dust hover:text-bone hover:underline"
          >
            Also on The Blue Alliance <External size={13} />
          </a>
        </section>
      </Container>

      {otherRobots.length > 0 && (
        <Container className="flex flex-col gap-6 pb-16">
          <h2 className="font-display text-4xl font-extrabold uppercase">Also built this season</h2>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {otherRobots.map((r) => (
              <li key={r.id} className="flex gap-5 rounded-md border border-line bg-panel p-5">
                <MediaImage mediaKey={r.photo_key} alt="" className="size-24 shrink-0 rounded" sizes="96px" maxWidth={320} />
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-3xl leading-none font-extrabold uppercase">{r.name}</span>
                  <span className="font-label text-xs text-dust uppercase">{r.kind}</span>
                  {r.description && <p className="text-sm text-sand">{r.description}</p>}
                  {r.code_url && (
                    <a href={r.code_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-hornet hover:text-hornet-hover">
                      Code on GitHub
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Container>
      )}

      {/* Roster */}
      {roster.length > 0 && (
        <section className="border-t border-line">
          <Container className="flex flex-col gap-10 py-16 md:py-24">
            <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-7xl">The {season.year} crew</h2>
            {students.length > 0 && <RosterGrid members={students} subteams={subteams} />}
            {mentors.length > 0 && (
              <div className="flex flex-col gap-6">
                <h3 className="font-display text-3xl font-extrabold uppercase">Mentors</h3>
                <RosterGrid members={mentors} />
              </div>
            )}
          </Container>
        </section>
      )}

      {outreachEvents.length > 0 && (
        <Container className="flex flex-col gap-6 pb-16">
          <h2 className="font-display text-4xl font-extrabold uppercase">Outreach this season</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {outreachEvents.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        </Container>
      )}

      {sponsors.length > 0 && (
        <section className="border-t border-line">
          <Container className="flex flex-col gap-10 py-16 md:py-24">
            <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-6xl">{season.year} sponsors</h2>
            <SponsorWall sponsors={sponsors} />
          </Container>
        </section>
      )}

      {/* Gallery */}
      <section id="gallery" className="border-t border-line bg-panel">
        <Container className="flex flex-col gap-8 py-16 md:py-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="font-display text-5xl font-extrabold uppercase md:text-[56px]">{season.year} gallery</h2>
            {albums.length > 0 && (
              <Link
                href={albums.length === 1 ? `/gallery/${albums[0].slug}` : `/gallery?season=${season.year}`}
                className="flex items-center gap-2 font-semibold text-hornet hover:text-hornet-hover"
              >
                {albums.length === 1 ? `Open album · ${albums[0].photo_count} photos` : `${albums.length} albums`}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {photos.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {photos.map((p) => (
                <li key={p.media_id} className="h-48 overflow-hidden rounded-md md:h-[360px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl(p.r2_key, 640) ?? ""}
                    srcSet={mediaSrcSet(p.r2_key, 1280)}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    alt={p.alt || p.caption}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No photos from {season.year} yet.</EmptyState>
          )}
        </Container>
      </section>
    </>
  );
}
