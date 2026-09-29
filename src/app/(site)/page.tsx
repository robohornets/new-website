import Link from "next/link";
import { EventRow, PostCard, RobotCard, SeasonStatusCard } from "@/components/cards";
import { ArrowRight } from "@/components/icons";
import { MediaImage } from "@/components/media-image";
import { SectionHeading } from "@/components/section-heading";
import { SponsorWall } from "@/components/sponsor-wall";
import {
  getCurrentSeason,
  getFeaturedRobots,
  getLatestSponsors,
  getPosts,
  getRobots,
  getSettings,
  getLiveEvents,
  getUpcomingEvents,
} from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { TeamEvent } from "@/lib/types";

/** Shown at the top of the homepage while 1209 is at an event. */
function LiveBanner({ event }: { event: TeamEvent }) {
  const status = [event.rank, event.record, event.playoff_result].filter(Boolean).join(" · ");
  return (
    <section aria-label="Live event" className="border-b border-hornet/40 bg-rust">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8 xl:px-16">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2 font-label text-xs font-bold tracking-widest text-hornet">
            <span className="size-2 animate-pulse rounded-full bg-hornet" aria-hidden="true" />
            LIVE NOW
          </span>
          <span className="font-semibold">{event.name}</span>
          {status && <span className="font-label text-sm text-sand">{status}</span>}
        </p>
        <div className="flex gap-2.5">
          {event.webcast_url && (
            <a
              href={event.webcast_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center rounded-md bg-hornet px-5 text-sm font-bold text-ink hover:bg-hornet-hover"
            >
              Watch live
            </a>
          )}
          <Link
            href={`/seasons/${event.season_year}/events/${event.id}`}
            className="flex h-11 items-center rounded-md border border-hornet/60 px-5 text-sm font-semibold text-bone hover:border-hornet"
          >
            Follow our matches
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [settings, season, featured, posts, sponsors, upcoming, live] = await Promise.all([
    getSettings(),
    getCurrentSeason(),
    getFeaturedRobots(3),
    getPosts({ limit: 3 }),
    getLatestSponsors(),
    getUpcomingEvents(3),
    getLiveEvents(),
  ]);
  const seasonRobots = season ? await getRobots(season.year) : [];
  const { hero, stats, about, build_steps, join, contact } = settings;

  const nextUp = upcoming[0]
    ? `${upcoming[0].name} · ${formatDate(upcoming[0].start_date, { year: undefined })}`
    : season?.status === "offseason"
      ? `Kickoff · Jan ${season.year + 1}`
      : season?.kickoff_date
        ? `Kickoff · ${formatDate(season.kickoff_date, { year: undefined })}`
        : null;

  return (
    <>
      {live.map((e) => (
        <LiveBanner key={e.id} event={e} />
      ))}

      {/* HERO */}
      <section className="relative overflow-hidden">
        <HexField />
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 px-4 pt-10 pb-12 md:px-8 lg:flex-row lg:gap-14 lg:pt-18 lg:pb-20 xl:px-16">
          <div className="flex flex-col gap-6 lg:w-[600px] lg:shrink-0 lg:pt-6 xl:w-[640px]">
            {hero.eyebrow && (
              <p className="flex items-center gap-3 font-label text-[11px] tracking-[0.12em] text-dust uppercase md:text-[13px]">
                <span className="size-2.5 shrink-0 rotate-45 bg-hornet" aria-hidden="true" />
                {hero.eyebrow}
              </p>
            )}
            {/* One word, capital R and H, per the branding guidelines. */}
            <h1 className="font-display text-[68px] leading-[0.9] font-black tracking-tight sm:text-[104px] xl:text-[128px]">
              {hero.titleTop}
              <span className="text-hornet">{hero.titleBottom}</span>
            </h1>
            {hero.intro && <p className="max-w-[540px] text-[17px] leading-relaxed text-sand md:text-xl">{hero.intro}</p>}
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/team"
                className="flex h-14 items-center justify-center gap-2.5 rounded-md bg-hornet px-7 text-[17px] font-bold text-ink hover:bg-hornet-hover"
              >
                Meet the team <ArrowRight size={18} />
              </Link>
              <Link
                href="/seasons"
                className="flex h-14 items-center justify-center rounded-md border-[1.5px] border-edge px-7 text-[17px] font-semibold text-bone hover:border-bone"
              >
                See our robots
              </Link>
            </div>
          </div>

          <div className="relative grow sm:min-h-[460px] lg:h-[620px]">
            <div className="chamfer relative h-[260px] overflow-hidden rounded sm:absolute sm:inset-0 sm:h-auto">
              {season?.hero_key ? (
                <MediaImage
                  mediaKey={season.hero_key}
                  alt={`Team 1209 in ${season.year}`}
                  className="size-full"
                  loading="eager"
                  sizes="(min-width: 1024px) 55vw, 100vw"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/images/team-2024.jpg"
                  alt="Team 1209 posing with their robot at a 2024 competition"
                  className="size-full object-cover"
                />
              )}
            </div>
            {season && (
              <SeasonStatusCard
                season={season}
                robotName={seasonRobots[0]?.name}
                nextUp={nextUp}
                className="mt-3 sm:absolute sm:bottom-9 sm:left-6 sm:mt-0 sm:w-[340px] lg:-left-10"
              />
            )}
          </div>
        </div>
      </section>

      {/* STATS */}
      {stats.length > 0 && (
        <>
          <div className="hazard h-3 md:h-3.5" aria-hidden="true" />
          <section aria-label="Team at a glance" className="border-b border-line bg-panel">
            <dl className="mx-auto grid max-w-[1440px] grid-cols-2 md:px-8 lg:grid-cols-4 xl:px-16">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={`flex flex-col-reverse justify-center gap-1.5 border-line px-4 py-6 md:py-10 lg:px-10 lg:first:pl-0 ${
                    i % 2 === 0 ? "border-r" : ""
                  } ${i < 2 ? "border-b lg:border-b-0" : ""} lg:border-r lg:last:border-r-0`}
                >
                  <dt className="text-[13px] text-dust md:text-[15px]">{s.label}</dt>
                  <dd className="font-display text-[44px] leading-none font-extrabold md:text-[64px]">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}

      {/* ABOUT */}
      <section className="mx-auto flex max-w-[1440px] flex-col gap-12 px-4 py-16 md:px-8 md:py-28 xl:px-16">
        <SectionHeading
          index="01"
          label="Who we are"
          title={about.heading}
          aside={<p className="max-w-md text-[17px] leading-relaxed text-sand md:text-lg">{about.body}</p>}
        />
        {build_steps.length > 0 && (
          <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
            {build_steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-4 rounded-md border border-line bg-panel p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[44px] leading-none font-extrabold text-hornet">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-label text-xs text-dust uppercase">{step.when}</span>
                </div>
                <h3 className="font-display text-[34px] leading-none font-bold uppercase">{step.title}</h3>
                <p className="leading-relaxed text-sand">{step.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* MACHINES */}
      {featured.length > 0 && (
        <section className="border-y border-line bg-panel">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-4 py-16 md:px-8 md:py-24 xl:px-16">
            <SectionHeading
              index="02"
              label="The machines"
              title="A new robot every year"
              aside={
                <Link href="/seasons" className="flex items-center gap-2 font-semibold text-hornet hover:text-hornet-hover">
                  All seasons <ArrowRight size={16} />
                </Link>
              }
            />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featured.map((r) => (
                <RobotCard key={r.id} robot={r} gameName={r.game_name} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* UPCOMING */}
      {upcoming.length > 0 && (
        <section className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 pt-16 md:px-8 md:pt-24 xl:px-16">
          <SectionHeading label="On the calendar" title="Upcoming events" />
          <ul className="grid gap-3 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        </section>
      )}

      {/* FROM THE HIVE */}
      {posts.length > 0 && (
        <section className="mx-auto flex max-w-[1440px] flex-col gap-12 px-4 py-16 md:px-8 md:py-28 xl:px-16">
          <SectionHeading
            index="03"
            label="From the hive"
            title="News & outreach"
            aside={
              <div className="flex gap-2">
                <Link href="/news" className="flex h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold text-sand hover:border-bone hover:text-bone">
                  News
                </Link>
                <Link href="/outreach" className="flex h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold text-sand hover:border-bone hover:text-bone">
                  Outreach
                </Link>
              </div>
            }
          />
          <div className="grid gap-10 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* SPONSORS */}
      <section className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-11 px-4 py-16 md:px-8 md:py-24 xl:px-16">
          <SectionHeading
            index="04"
            label="Sponsors"
            title="Powered by our partners"
            aside={
              <Link
                href="/sponsors#support"
                className="flex h-13 items-center self-start rounded-md border-[1.5px] border-hornet px-6 font-bold text-hornet hover:border-hornet hover:text-hornet-hover md:self-auto"
              >
                Become a sponsor
              </Link>
            }
          />
          <SponsorWall sponsors={sponsors.sponsors} />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-16 md:grid-cols-2 md:gap-6 md:px-8 md:py-24 xl:px-16">
        <div className="flex flex-col justify-between gap-8 rounded-md bg-hornet p-7 text-ink md:p-12">
          <div className="flex flex-col gap-3.5">
            <span className="eyebrow font-bold">BTW students</span>
            <h2 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-[64px]">{join.heading}</h2>
            <p className="max-w-md text-[17px] leading-relaxed">{join.body}</p>
          </div>
          <Link href="/contact?topic=joining" className="flex h-13 items-center self-start rounded-md bg-ink px-6 font-bold text-bone hover:bg-raise">
            How to join
          </Link>
        </div>
        <div className="flex flex-col justify-between gap-8 rounded-md border border-line bg-panel p-7 md:p-12">
          <div className="flex flex-col gap-3.5">
            <span className="eyebrow eyebrow-bar text-bone">Sponsors · Mentors · Donors</span>
            <h2 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-[64px]">Get in touch</h2>
            <p className="max-w-md text-[17px] leading-relaxed text-sand">{contact.intro}</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href="/contact" className="flex h-13 items-center justify-center rounded-md bg-bone px-6 font-bold text-ink hover:bg-sand">
              Send a message
            </Link>
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="font-label text-[15px] text-hornet hover:text-hornet-hover">
                {contact.email}
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function HexField() {
  const hexes: [number, number, boolean][] = [
    [60, 0, false], [190, 0, false], [125, 112, false], [255, 112, true], [60, 224, false],
    [190, 224, false], [320, 224, false], [125, 336, false], [255, 336, false],
  ];
  return (
    <svg
      width="620"
      height="560"
      viewBox="0 0 620 560"
      className="pointer-events-none absolute -bottom-16 -left-20 hidden opacity-35 lg:block"
      aria-hidden="true"
    >
      {hexes.map(([x, y, hot]) => (
        <polygon
          key={`${x}-${y}`}
          points={`${x},${y} ${x + 60},${y + 34} ${x + 60},${y + 104} ${x},${y + 138} ${x - 60},${y + 104} ${x - 60},${y + 34}`}
          fill="none"
          stroke={hot ? "#ff7a1a" : "#34302a"}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}
