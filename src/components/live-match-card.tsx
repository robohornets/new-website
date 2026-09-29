"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LiveMatch, LiveMatchData } from "@/lib/live-match";

const POLL_MS = 60_000;

// A clock that ticks every 30 seconds, for "in 12 min". Null while rendering
// on the server, so the relative time never mismatches on hydration.
const TICK = 30_000;
function subscribeClock(fn: () => void) {
  const id = setInterval(fn, TICK);
  return () => clearInterval(id);
}
const clockNow = () => Math.floor(Date.now() / TICK) * TICK;
const noClock = () => null;

function clockTime(unix: number, zone: string) {
  return new Date(unix * 1000).toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });
}

function relative(unix: number, now: number | null): string | null {
  if (now == null) return null;
  const min = Math.round((unix * 1000 - now) / 60_000);
  if (min > 90) return `in ${Math.floor(min / 60)} hr ${min % 60} min`;
  if (min > 1) return `in ${min} min`;
  if (min >= -3) return "any minute now";
  return "up next";
}

function Teams({ side, teams, us }: { side: "red" | "blue"; teams: string[]; us?: string }) {
  const color = side === "red" ? "border-[#ff8f8f] text-[#ffb3b3]" : "border-[#8fb8ff] text-[#b8d1ff]";
  return (
    <div className={`flex min-w-0 items-center gap-3 border-l-[3px] pl-3 ${color}`}>
      <span className="w-12 shrink-0 font-label text-[11px] font-bold tracking-widest uppercase">{side}</span>
      <span className="flex flex-wrap gap-x-3 font-display text-2xl leading-none font-extrabold tabular-nums md:text-[28px]">
        {us && <span className="text-hornet">{us}</span>}
        {teams.map((t) => (
          <span key={t} className="text-bone">
            {t}
          </span>
        ))}
      </span>
    </div>
  );
}

function Alliances({ match, us }: { match: LiveMatch; us: string }) {
  const theirs = match.alliance === "red" ? "blue" : "red";
  return (
    <div className="flex flex-col gap-2">
      <Teams side={match.alliance} teams={match.partners} us={us} />
      <Teams side={theirs} teams={match.opponents} />
    </div>
  );
}

const RESULT = {
  win: { text: "Win", className: "bg-hornet text-ink" },
  loss: { text: "Loss", className: "bg-ink-deep/70 text-sand" },
  tie: { text: "Tie", className: "bg-ink-deep/70 text-bone" },
  "": { text: "Played", className: "bg-ink-deep/70 text-sand" },
};

function Box({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 rounded-md border border-white/10 bg-ink-deep/55 p-4 md:p-5 ${className}`}>
      <span className="font-label text-[11px] font-bold tracking-widest text-hornet uppercase">{label}</span>
      {children}
    </div>
  );
}

function Card({ data, now }: { data: LiveMatchData; now: number | null }) {
  const { event, next, last } = data;
  const soon = next?.time ? relative(next.time, now) : null;
  return (
    <section aria-label={`Live: ${event.name}`} className="border-b border-hornet/40 bg-rust">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-8 md:py-5 xl:px-16">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-2 font-label text-xs font-bold tracking-widest text-hornet">
              <span className="size-2 animate-pulse rounded-full bg-hornet" aria-hidden="true" />
              LIVE NOW
            </span>
            <span className="font-semibold">{event.name}</span>
            {data.status.length > 0 && <span className="font-label text-sm text-sand">{data.status.join(" · ")}</span>}
          </p>
          <div className="flex gap-2.5">
            {event.webcast && (
              <a
                href={event.webcast}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center rounded-md bg-hornet px-5 text-sm font-bold text-ink hover:bg-hornet-hover"
              >
                Watch live
              </a>
            )}
            <Link
              href={event.url}
              className="flex h-11 items-center rounded-md border border-hornet/60 px-5 text-sm font-semibold text-bone hover:border-hornet"
            >
              All our matches
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[3fr_2fr]">
          {next ? (
            <Box label="Next match">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-4xl leading-none font-extrabold uppercase md:text-5xl">{next.label}</span>
                {next.time && (
                  <span className="font-label text-sm text-sand">
                    {next.predicted ? "about " : ""}
                    {clockTime(next.time, event.timezone)}
                    {soon && <strong className="ml-2 text-bone">{soon}</strong>}
                  </span>
                )}
              </div>
              <Alliances match={next} us={data.team} />
            </Box>
          ) : (
            <Box label={data.finished ? "That's a wrap" : "Next match"}>
              <p className="text-[17px] font-semibold">
                {data.finished
                  ? "We're done playing at this event. Thanks for cheering!"
                  : last
                    ? "Waiting on the next match to be scheduled."
                    : "The match schedule isn't out yet. Check back soon."}
              </p>
            </Box>
          )}
          {last && (
            <Box label="Last match">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-display text-3xl leading-none font-extrabold uppercase">{last.label}</span>
                <span className={`rounded px-2 py-1 font-label text-xs font-bold tracking-wider uppercase ${RESULT[last.result].className}`}>
                  {RESULT[last.result].text}
                </span>
                <span className="font-display text-3xl leading-none font-extrabold tabular-nums">
                  {last.ourScore}
                  <span className="px-1.5 text-dust">–</span>
                  {last.theirScore}
                </span>
              </div>
              <p className="text-sm text-sand">
                With {last.partners.join(" & ") || "—"} vs {last.opponents.join(", ") || "—"}
              </p>
            </Box>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Our next and last match while we're at a competition, above the homepage
 * hero. Checks for news once a minute (while the tab is visible) and goes
 * away by itself once the event is over.
 */
export function LiveMatchCards({ initial }: { initial: LiveMatchData[] }) {
  const [list, setList] = useState(initial);
  const now = useSyncExternalStore(subscribeClock, clockNow, noClock);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/live-match", { cache: "no-store" });
        if (res.ok && !stopped) setList((await res.json()) as LiveMatchData[]);
      } catch {
        // Offline for a moment: keep showing what we have.
      }
    };
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return list.map((d) => <Card key={d.event.id} data={d} now={now} />);
}
