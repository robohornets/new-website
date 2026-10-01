import Link from "next/link";
import { formatDate, monthDay, seasonLabel } from "@/lib/format";
import { SEASON_STATUS_LABEL, type Post, type Robot, type Season, type TeamEvent } from "@/lib/types";
import { MediaImage } from "./media-image";

export function SeasonStatusCard({
  season,
  robotName,
  nextUp,
  className = "",
}: {
  season: Season;
  robotName?: string | null;
  nextUp?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-3.5 rounded-md border border-line-strong bg-panel p-5 shadow-[0_24px_48px_rgba(0,0,0,0.45)] md:px-6 md:py-5.5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow text-xs text-dust">Current season</span>
        <span className="rounded bg-rust px-2 py-1 font-label text-xs text-white uppercase">
          {SEASON_STATUS_LABEL[season.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-5xl leading-[0.9] font-black md:text-[56px]">{seasonLabel(season.year)}</span>
        <span className="font-display text-2xl font-bold tracking-wide text-hornet uppercase md:text-[30px]">
          {season.game_name || "TBA"}
        </span>
      </div>
      <div className="h-px bg-line-strong" />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-dust">Robot</dt>
          <dd className="font-semibold">{robotName || "To be built"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-dust">Next up</dt>
          <dd className="font-semibold">{nextUp || "Stay tuned"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function RobotCard({ robot, gameName }: { robot: Robot; gameName?: string }) {
  return (
    <Link
      href={`/seasons/${robot.season_year}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-ink text-bone hover:border-edge"
    >
      <div className="relative h-60 md:h-[300px]">
        <MediaImage
          mediaKey={robot.photo_key}
          alt={`${robot.name}, the ${seasonLabel(robot.season_year)} robot`}
          placeholder={`${robot.name} photo coming soon`}
          className="size-full"
        />
        <span className="absolute top-4 left-4 rounded border border-line-strong bg-ink px-2.5 py-1 font-label text-xs">
          {seasonLabel(robot.season_year)}
          {gameName ? ` · ${gameName}` : ""}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 p-6 md:p-7">
        <h3 className="font-display text-4xl leading-none font-extrabold uppercase group-hover:text-hornet md:text-[44px]">
          {robot.name}
        </h3>
        {robot.description && <p className="text-[15px] leading-relaxed text-sand">{robot.description}</p>}
        {robot.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {robot.tags.map((t) => (
              <li key={t} className="rounded bg-raise px-2.5 py-1 font-label text-xs text-sand">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}

/** An outreach post on the Impact page, the homepage and its season's page. */
export function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/impact/${post.slug}`} className="group flex flex-col gap-4.5 text-bone">
      <div className="h-60 overflow-hidden rounded-md">
        <MediaImage mediaKey={post.cover_key} alt="" className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
      <div className="flex items-center gap-2.5 font-label text-xs tracking-wider uppercase">
        <span className="text-hornet">Outreach</span>
        {post.published_at && (
          <>
            <span className="text-ash">·</span>
            <time dateTime={post.published_at} className="text-dust">
              {formatDate(post.published_at)}
            </time>
          </>
        )}
      </div>
      <h3 className="font-display text-[32px] leading-[1.05] font-bold uppercase group-hover:text-hornet">{post.title}</h3>
      {post.excerpt && <p className="text-[15px] leading-relaxed text-dust">{post.excerpt}</p>}
    </Link>
  );
}

/**
 * An event in a list, linking to its page on our site. Pass `matches` (the
 * season page does) to say on the row that the match list is there.
 */
export function EventRow({ event, matches }: { event: TeamEvent; matches?: { count: number; ended: boolean } }) {
  const md = monthDay(event.start_date);
  const results = event.rank || event.awards || event.record || event.playoff_result;
  const cta = matches
    ? matches.count > 0
      ? `${matches.count} ${matches.count === 1 ? "match" : "matches"}`
      : matches.ended
        ? "Event details"
        : "Results soon"
    : null;
  return (
    <li>
      <Link
        href={`/seasons/${event.season_year}/events/${event.id}`}
        className="group flex items-center gap-4 rounded-md border border-line bg-ink px-4 py-4.5 hover:border-edge sm:gap-5 sm:px-5"
      >
        <div className="flex w-14 shrink-0 flex-col items-center gap-0.5 sm:w-16">
          <span className="font-label text-xs text-dust">{md?.month ?? "TBD"}</span>
          <span className="font-display text-[34px] leading-none font-extrabold">{md?.day ?? "–"}</span>
        </div>
        {/* On phones the results sit under the name; from sm up, on the right. */}
        <div className="flex min-w-0 grow flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[17px] font-semibold group-hover:text-hornet">{event.name}</span>
            {event.location && <span className="text-sm text-dust">{event.location}</span>}
          </div>
          {(results || cta) && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:shrink-0 sm:flex-col sm:items-end sm:text-right">
              {event.rank && <span className="font-label text-sm font-bold text-hornet">{event.rank}</span>}
              {event.record && <span className="font-label text-xs text-dust">{event.record}</span>}
              {event.playoff_result && <span className="text-[13px] text-sand">{event.playoff_result}</span>}
              {event.awards && <span className="text-[13px] text-dust">{event.awards}</span>}
              {cta && (
                <span
                  className={`flex basis-full items-center gap-1.5 text-sm font-semibold sm:mt-1 sm:basis-auto ${
                    matches!.count > 0 ? "text-bone group-hover:text-hornet" : "text-dust group-hover:text-bone"
                  }`}
                >
                  {cta}
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
