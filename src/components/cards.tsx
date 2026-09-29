import Link from "next/link";
import { formatDate, monthDay } from "@/lib/format";
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
        <span className="rounded bg-amber-bg px-2 py-1 font-mono text-xs text-amber uppercase">
          {SEASON_STATUS_LABEL[season.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-5xl leading-[0.9] font-black md:text-[56px]">{season.year}</span>
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
          alt={`${robot.name}, the ${robot.season_year} robot`}
          placeholder={`${robot.name} photo coming soon`}
          className="size-full"
        />
        <span className="absolute top-4 left-4 rounded border border-line-strong bg-ink px-2.5 py-1 font-mono text-xs">
          {robot.season_year}
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
              <li key={t} className="rounded bg-raise px-2.5 py-1 font-mono text-xs text-sand">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}

export function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/news/${post.slug}`} className="group flex flex-col gap-4.5 text-bone">
      <div className="h-60 overflow-hidden rounded-md">
        <MediaImage
          mediaKey={post.cover_key}
          alt=""
          className="size-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex items-center gap-2.5 font-mono text-xs tracking-wider uppercase">
        <span className="text-hornet">{post.category}</span>
        {post.published_at && (
          <>
            <span className="text-ash">·</span>
            <time dateTime={post.published_at} className="text-dust">
              {formatDate(post.published_at)}
            </time>
          </>
        )}
      </div>
      <h3 className="font-display text-[32px] leading-[1.05] font-bold uppercase group-hover:text-hornet">
        {post.title}
      </h3>
      {post.excerpt && <p className="text-[15px] leading-relaxed text-dust">{post.excerpt}</p>}
    </Link>
  );
}

export function EventRow({ event }: { event: TeamEvent }) {
  const md = monthDay(event.start_date);
  return (
    <li>
      <Link
        href={`/seasons/${event.season_year}/events/${event.id}`}
        className="group flex items-center gap-5 rounded-md border border-line bg-ink px-5 py-4.5 hover:border-edge"
      >
        <div className="flex w-16 shrink-0 flex-col items-center gap-0.5">
          <span className="font-mono text-xs text-dust">{md?.month ?? "TBD"}</span>
          <span className="font-display text-[34px] leading-none font-extrabold">{md?.day ?? "–"}</span>
        </div>
        <div className="flex min-w-0 grow flex-col gap-1">
          <span className="text-[17px] font-semibold group-hover:text-hornet">{event.name}</span>
          {event.location && <span className="text-sm text-dust">{event.location}</span>}
        </div>
        {(event.rank || event.awards || event.record || event.playoff_result) && (
          <div className="flex flex-col items-end gap-1 text-right">
            {event.rank && <span className="font-mono text-sm font-bold text-amber">{event.rank}</span>}
            {event.record && <span className="font-mono text-xs text-dust">{event.record}</span>}
            {event.playoff_result && <span className="text-[13px] text-sand">{event.playoff_result}</span>}
            {event.awards && <span className="text-[13px] text-dust">{event.awards}</span>}
          </div>
        )}
      </Link>
    </li>
  );
}
