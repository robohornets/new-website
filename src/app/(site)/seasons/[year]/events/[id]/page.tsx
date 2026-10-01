import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, External } from "@/components/icons";
import { Container } from "@/components/page-header";
import { VideoEmbed } from "@/components/video-embed";
import { getAlbumPhotos, getEvent, getMatches } from "@/lib/data";
import { first } from "@/lib/db";
import { formatDate, seasonLabel } from "@/lib/format";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { matchLabel } from "@/lib/tba/map";
import type { Match, TeamEvent } from "@/lib/types";

const OUR_TEAM = "1209";

async function load(props: PageProps<"/seasons/[year]/events/[id]">): Promise<TeamEvent | null> {
  const { year, id } = await props.params;
  const event = await getEvent(Number(id));
  if (!event || event.hidden || String(event.season_year) !== year) return null;
  return event;
}

export async function generateMetadata(props: PageProps<"/seasons/[year]/events/[id]">): Promise<Metadata> {
  const event = await load(props);
  if (!event) return { title: "Event not found" };
  const bits = [event.rank, event.playoff_result, event.awards].filter(Boolean).join(" · ");
  return {
    title: `${event.name} (${seasonLabel(event.season_year)})`,
    description: `Team 1209 at ${event.name}${bits ? `: ${bits}` : ""}.`,
  };
}

function dateRange(e: TeamEvent) {
  if (!e.start_date) return "";
  const start = formatDate(e.start_date, { year: undefined });
  const end = e.end_date && e.end_date !== e.start_date ? formatDate(e.end_date) : formatDate(e.start_date);
  return e.end_date && e.end_date !== e.start_date ? `${start} – ${end}` : end;
}

export default async function EventPage(props: PageProps<"/seasons/[year]/events/[id]">) {
  const event = await load(props);
  if (!event) notFound();
  const [matches, album] = await Promise.all([
    getMatches(event.id),
    event.album_id
      ? first<{ id: number; slug: string; title: string }>("SELECT id, slug, title FROM albums WHERE id = ? AND published = 1", event.album_id)
      : null,
  ]);
  const photos = album ? (await getAlbumPhotos(album.id, 8)).filter((p) => p.content_type.startsWith("image/")) : [];
  const quals = matches.filter((m) => m.comp_level === "qm");
  const playoffs = matches.filter((m) => m.comp_level !== "qm");
  const summary = [
    { label: "Qualification rank", value: event.rank },
    { label: "Qualification record", value: event.record },
    { label: "Alliance", value: event.alliance },
    { label: "Playoffs", value: event.playoff_result },
  ].filter((s) => s.value);
  const awards = event.awards
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  return (
    <>
      <Container className="flex flex-col gap-5 pt-12 pb-10 md:pt-18">
        <nav aria-label="Breadcrumb" className="font-label text-xs tracking-wider text-dust uppercase">
          <Link href="/seasons" className="hover:text-bone">
            Seasons
          </Link>
          <span className="px-2 text-ash">/</span>
          <Link href={`/seasons/${event.season_year}#events`} className="hover:text-bone">
            {seasonLabel(event.season_year)} season
          </Link>
        </nav>
        <h1 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">{event.name}</h1>
        <p className="font-label text-sm text-dust">
          {[dateRange(event), event.location].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap gap-3">
          {event.webcast_url && (
            <a
              href={event.webcast_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center gap-2 rounded-md bg-hornet px-5 font-bold text-ink hover:bg-hornet-hover"
            >
              Webcast <External size={16} />
            </a>
          )}
          {event.tba_key && (
            <a
              href={`https://www.thebluealliance.com/event/${event.tba_key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center gap-2 rounded-md border-[1.5px] border-edge px-5 font-semibold hover:border-bone"
            >
              On The Blue Alliance <External size={16} />
            </a>
          )}
          {event.website && (
            <a href={event.website} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center gap-2 px-2 font-semibold text-hornet hover:text-hornet-hover">
              Event website <External size={16} />
            </a>
          )}
        </div>
      </Container>

      {(summary.length > 0 || awards.length > 0) && (
        <Container className="pb-12">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-1.5 rounded-md border border-line bg-panel p-5">
                <dt className="text-sm text-dust">{s.label}</dt>
                <dd className="font-display text-3xl leading-tight font-extrabold uppercase">{s.value}</dd>
              </div>
            ))}
          </dl>
          {awards.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Awards">
              {awards.map((a) => (
                <li key={a} className="rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white">
                  {a}
                </li>
              ))}
            </ul>
          )}
        </Container>
      )}

      {(event.highlight_video_url || event.recap) && (
        <Container className="grid gap-8 pb-14 lg:grid-cols-[1.4fr_1fr]">
          {event.highlight_video_url && <VideoEmbed url={event.highlight_video_url} title={`${event.name} highlights`} />}
          {event.recap && <p className="text-lg leading-relaxed whitespace-pre-line text-sand">{event.recap}</p>}
        </Container>
      )}

      {matches.length > 0 && (
        <section className="border-t border-line bg-panel">
          <Container className="flex flex-col gap-10 py-14 md:py-20">
            <h2 className="font-display text-5xl font-extrabold uppercase">Matches</h2>
            {playoffs.length > 0 && <MatchTable title="Playoffs" matches={playoffs} year={event.season_year} />}
            {quals.length > 0 && <MatchTable title="Qualification" matches={quals} year={event.season_year} />}
            <p className="text-xs text-ash">Match data from The Blue Alliance.</p>
          </Container>
        </section>
      )}

      {album && photos.length > 0 && (
        <Container className="flex flex-col gap-6 py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-display text-4xl font-extrabold uppercase">Photos</h2>
            <Link href={`/gallery/${album.slug}`} className="flex items-center gap-2 font-semibold text-hornet hover:text-hornet-hover">
              {album.title} <ArrowRight size={16} />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((p) => (
              <li key={p.media_id} className="h-40 overflow-hidden rounded-md md:h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(p.r2_key, 640) ?? ""}
                  srcSet={mediaSrcSet(p.r2_key, 960)}
                  sizes="(min-width: 768px) 25vw, 50vw"
                  alt={p.alt || p.caption || `Photo from ${event.name}`}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  );
}

function Teams({ list, year, color }: { list: string; year: number; color: "red" | "blue" }) {
  const teams = list
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {teams.map((t) => {
        const us = t === OUR_TEAM;
        return (
          <li key={t}>
            <a
              href={`https://www.thebluealliance.com/team/${t}/${year}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex h-8 items-center rounded px-2 font-label text-sm ${
                us
                  ? "bg-hornet font-bold text-ink"
                  : color === "red"
                    ? "bg-[#3a1717] text-[#ffb3b3] hover:bg-[#4a1d1d]"
                    : "bg-[#152238] text-[#b3cfff] hover:bg-[#1b2c48]"
              }`}
              aria-label={us ? `Team ${t} (us)` : `Team ${t} on The Blue Alliance`}
            >
              {t}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function MatchTable({ title, matches, year }: { title: string; matches: Match[]; year: number }) {
  const wins = matches.filter((m) => m.result === "win").length;
  const losses = matches.filter((m) => m.result === "loss").length;
  const ties = matches.filter((m) => m.result === "tie").length;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-baseline gap-3 font-display text-2xl font-bold uppercase">
        {title}
        <span className="font-label text-sm font-normal text-dust normal-case">
          {wins}-{losses}-{ties}
        </span>
      </h3>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-ink font-label text-[11px] tracking-wider text-ash uppercase">
            <tr>
              <th className="px-4 py-2.5 font-normal">Match</th>
              <th className="px-4 py-2.5 font-normal">Red alliance</th>
              <th className="px-4 py-2.5 text-center font-normal">Score</th>
              <th className="px-4 py-2.5 font-normal">Blue alliance</th>
              <th className="px-4 py-2.5 font-normal">Result</th>
              <th className="px-4 py-2.5 font-normal">
                <span className="sr-only">Video</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-ink/40">
            {matches.map((m) => {
              const scored = m.red_score !== null && m.blue_score !== null;
              const redWon = scored && m.red_score! > m.blue_score!;
              const blueWon = scored && m.blue_score! > m.red_score!;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{matchLabel(m)}</td>
                  <td className="px-4 py-3">
                    <Teams list={m.red_teams} year={year} color="red" />
                  </td>
                  <td className="px-4 py-3 text-center font-label whitespace-nowrap">
                    {scored ? (
                      <>
                        <span className={redWon ? "font-bold text-[#ff8f8f]" : "text-dust"}>{m.red_score}</span>
                        <span className="px-1.5 text-ash">–</span>
                        <span className={blueWon ? "font-bold text-[#8fb8ff]" : "text-dust"}>{m.blue_score}</span>
                      </>
                    ) : (
                      <span className="text-ash">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Teams list={m.blue_teams} year={year} color="blue" />
                  </td>
                  <td className="px-4 py-3">
                    {m.result === "win" && <span className="rounded bg-rust px-2 py-1 font-label text-xs font-bold text-white">WIN</span>}
                    {m.result === "loss" && <span className="rounded bg-raise px-2 py-1 font-label text-xs text-dust">LOSS</span>}
                    {m.result === "tie" && <span className="rounded bg-raise px-2 py-1 font-label text-xs text-sand">TIE</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.video_url && (
                      <a href={m.video_url} target="_blank" rel="noopener noreferrer" className="font-semibold whitespace-nowrap text-hornet hover:text-hornet-hover">
                        Video
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
