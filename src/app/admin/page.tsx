import Link from "next/link";
import { Plus } from "@/components/icons";
import { MediaImage } from "@/components/media-image";
import { getCurrentSeason, getEvents, getRobots, getRoster, getSeasonSponsors } from "@/lib/data";
import { all, first } from "@/lib/db";
import { formatBytes, formatDateTime, seasonLabel } from "@/lib/format";
import { formatHours, getOutreachTotals } from "@/lib/outreach";
import { SEASON_STATUS_LABEL, type Message } from "@/lib/types";
import { AdminPageHeader, Panel } from "./_components/fields";
import { HelpStartCard } from "./_help/help-panel";
import { requireAdminPage } from "@/lib/auth";

export default async function AdminDashboard() {
  await requireAdminPage();
  const season = await getCurrentSeason();
  const [robots, events, roster, sponsors, counts, messages, outreach] = await Promise.all([
    season ? getRobots(season.year) : [],
    season ? getEvents(season.year) : [],
    season ? getRoster(season.year) : [],
    season ? getSeasonSponsors(season.year) : [],
    first<{ albums: number; media: number; bytes: number; sponsors: number }>(
      `SELECT (SELECT COUNT(*) FROM albums) AS albums,
              (SELECT COUNT(*) FROM media) AS media,
              (SELECT COALESCE(SUM(size_bytes), 0) FROM media) AS bytes,
              (SELECT COUNT(*) FROM sponsors) AS sponsors`,
    ),
    all<Message>("SELECT * FROM messages WHERE archived = 0 ORDER BY created_at DESC LIMIT 6"),
    season ? getOutreachTotals(season.year) : null,
  ]);
  const seasonPhotos = season
    ? await first<{ n: number }>(
        "SELECT COUNT(*) AS n FROM album_photos ap JOIN albums a ON a.id = ap.album_id WHERE a.season_year = ?",
        season.year,
      )
    : null;

  const mainRobot = robots[0];
  const checklist = season
    ? [
        { done: Boolean(season.game_name), label: "Game name", href: `/admin/seasons/${season.year}` },
        { done: Boolean(season.summary), label: "Season summary", href: `/admin/seasons/${season.year}` },
        { done: Boolean(mainRobot), label: "Robot added", href: `/admin/seasons/${season.year}#robots` },
        { done: Boolean(mainRobot?.photo_key), label: "Robot photo", href: `/admin/seasons/${season.year}#robots` },
        { done: events.length > 0, label: "Competitions", href: `/admin/seasons/${season.year}#events` },
        { done: roster.length > 0, label: "Roster", href: `/admin/roster?season=${season.year}` },
        { done: sponsors.length > 0, label: "Sponsors", href: `/admin/sponsors?season=${season.year}` },
        { done: (seasonPhotos?.n ?? 0) > 0, label: "Photos", href: "/admin/gallery" },
      ]
    : [];
  const done = checklist.filter((c) => c.done).length;
  const nextYear = (season?.year ?? new Date().getFullYear()) + 1;

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Everything on the public site comes from here. Changes go live as soon as you save."
        actions={
          <>
            <Link href="/" className="flex h-11 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
              View site
            </Link>
            <Link
              href={`/admin/seasons/new?year=${nextYear}`}
              className="flex h-11 items-center gap-2 rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-hornet-hover"
            >
              <Plus size={16} /> Start {seasonLabel(nextYear)} season
            </Link>
          </>
        }
      />

      <HelpStartCard />

      {season ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="flex flex-col gap-6 rounded-md border border-line bg-panel p-6 sm:flex-row xl:col-span-2">
            <MediaImage
              mediaKey={season.hero_key ?? mainRobot?.photo_key}
              alt=""
              placeholder="robot photo"
              className="h-40 w-full shrink-0 rounded-md sm:w-52"
            />
            <div className="flex grow flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-rust px-2 py-1 font-label text-[11px] text-white">LIVE ON SITE</span>
                <span className="text-[13px] text-dust">{SEASON_STATUS_LABEL[season.status]}</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-5xl leading-none font-black">{seasonLabel(season.year)}</span>
                <span className="font-display text-2xl font-bold text-hornet uppercase">
                  {season.game_name || "TBA"}
                  {mainRobot ? ` · ${mainRobot.name}` : ""}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-sand">Season page completeness</span>
                  <span className="font-label">
                    {done} / {checklist.length}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-line">
                  <div className="h-full bg-hornet" style={{ width: `${(done / checklist.length) * 100}%` }} />
                </div>
              </div>
              <ul className="flex flex-wrap gap-2 text-[13px]">
                {checklist
                  .filter((c) => !c.done)
                  .map((c) => (
                    <li key={c.label}>
                      <Link href={c.href} className="rounded border border-line-strong px-2 py-1 text-dust hover:border-hornet hover:text-bone">
                        + {c.label}
                      </Link>
                    </li>
                  ))}
              </ul>
              <Link href={`/admin/seasons/${season.year}`} className="mt-auto text-sm font-semibold text-hornet hover:text-hornet-hover">
                Edit {seasonLabel(season.year)} season
              </Link>
            </div>
          </section>
          <section className="flex flex-col gap-3 rounded-md border border-line bg-panel p-6">
            <span className="eyebrow text-[11px] text-ash">Media · R2 bucket</span>
            <span className="font-display text-5xl leading-none font-extrabold">{counts?.media ?? 0}</span>
            <span className="text-[13px] text-dust">files · {formatBytes(counts?.bytes ?? 0)} used</span>
            <Link href="/admin/media" className="mt-auto text-sm font-semibold text-hornet hover:text-hornet-hover">
              Upload photos
            </Link>
          </section>
        </div>
      ) : (
        <Panel title="No seasons yet" description="Start by adding the current FRC season.">
          <Link href={`/admin/seasons/new?year=${new Date().getFullYear()}`} className="self-start font-semibold text-hornet">
            Create a season
          </Link>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat href={season ? `/admin/roster?season=${season.year}` : "/admin/roster"} label={`Roster${season ? ` · ${season.year}` : ""}`} value={roster.length} sub={`${roster.filter((r) => r.kind === "student").length} students · ${roster.filter((r) => r.kind === "mentor").length} mentors`} />
        <Stat href="/admin/sponsors" label="Sponsors" value={counts?.sponsors ?? 0} sub={`${sponsors.length} this season`} />
        <Stat
          href="/admin/impact"
          label={`Impact hours${season ? ` · ${seasonLabel(season.year)}` : ""}`}
          value={formatHours(outreach?.hours ?? 0)}
          sub={`${outreach?.events ?? 0} impact events · ${outreach?.volunteers ?? 0} helped`}
        />
        <Stat href="/admin/gallery" label="Gallery albums" value={counts?.albums ?? 0} sub={`${seasonPhotos?.n ?? 0} photos this season`} />
      </div>

      <section className="flex flex-col overflow-hidden rounded-md border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-2xl font-bold uppercase">Contact messages</h2>
          <Link href="/admin/messages" className="text-sm font-semibold text-hornet hover:text-hornet-hover">
            Open inbox
          </Link>
        </div>
        {messages.length === 0 ? (
          <p className="px-6 py-8 text-sm text-dust">No messages yet.</p>
        ) : (
          <ul>
            {messages.map((m) => (
              <li key={m.id} className="border-b border-line/60 last:border-0">
                <Link href={`/admin/messages#m${m.id}`} className="grid grid-cols-[12px_1fr] gap-x-4 gap-y-1 px-6 py-3.5 text-sm hover:bg-raise/50 md:grid-cols-[12px_200px_130px_1fr_110px] md:items-center">
                  <span className={`size-2 rounded-full ${m.read_at ? "bg-line-strong" : "bg-hornet"}`} aria-label={m.read_at ? "Read" : "Unread"} />
                  <span className={m.read_at ? "" : "font-bold"}>{m.name}</span>
                  <span className="col-start-2 font-label text-xs text-sand uppercase md:col-start-auto">{m.topic}</span>
                  <span className="col-start-2 truncate text-dust md:col-start-auto">{m.body}</span>
                  <span className="col-start-2 text-[13px] text-ash md:col-start-auto">{formatDateTime(m.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({ href, label, value, sub }: { href: string; label: string; value: number | string; sub: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1.5 rounded-md border border-line bg-panel p-5 hover:border-edge">
      <span className="text-[13px] text-dust">{label}</span>
      <span className="font-display text-4xl leading-none font-extrabold">{value}</span>
      <span className="text-xs text-ash">{sub}</span>
    </Link>
  );
}
