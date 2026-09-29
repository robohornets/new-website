"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ScoutingAnswers } from "@/components/scouting-answers";
import type { ScoutEntry, ScoutEvent, ScoutMatch, ScoutTeamRow, TeamDetail } from "@/lib/scouting-data";
import { summarize, type ScoutingData, type ScoutingForm, type ScoutingValue } from "@/lib/scouting";
import { FormFields } from "./fields";
import { enqueue, getName, getQueue, isPending, load, newId, onNameChange, onQueueChange, read, setName, sync, withQueued, type Op } from "./store";

type Boot =
  | { open: false; year: number }
  | { open: true; year: number; form: ScoutingForm; events: ScoutEvent[]; scouted: { number: number; nickname: string; hasRobot: boolean; reports: number }[] };

type Route = { view: "home" } | { view: "event"; event: string } | { view: "team"; team: number; event: string | null };

function parseHash(hash: string): Route {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const team = Number(p.get("team"));
  if (Number.isInteger(team) && team > 0) return { view: "team", team, event: p.get("event") };
  const event = p.get("event");
  if (event) return { view: "event", event };
  return { view: "home" };
}

function go(route: Route) {
  const p = new URLSearchParams();
  if (route.view === "team") {
    p.set("team", String(route.team));
    if (route.event) p.set("event", route.event);
  } else if (route.view === "event") p.set("event", route.event);
  location.hash = p.toString();
  window.scrollTo({ top: 0 });
}

const button = "flex h-11 items-center justify-center gap-2 rounded-md px-4 text-[15px] font-bold";
const primary = `${button} bg-hornet text-ink hover:bg-hornet-hover disabled:opacity-60`;
const secondary = `${button} border border-line-strong text-bone hover:border-bone`;
const input =
  "h-12 w-full rounded-md border border-edge bg-ink px-3.5 text-base text-bone placeholder:text-ash focus:border-hornet focus:outline-none";

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---- Shared state hooks -----------------------------------------------------------

function useQueue() {
  return useSyncExternalStore(
    onQueueChange,
    () => JSON.stringify(getQueue()),
    () => "[]",
  );
}

function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function useRoute() {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => location.hash,
    () => "",
  );
  return useMemo(() => parseHash(hash), [hash]);
}

/** Loads an API path with the phone's saved copy as a fallback. `version` forces a reload. */
function useLoad<T>(path: string | null, cacheKey: string, version: number) {
  const [state, setState] = useState<{ key: string; data: T | null; at: string | null; fromCache: boolean; loading: boolean }>({
    key: "",
    data: null,
    at: null,
    fromCache: false,
    loading: true,
  });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    // Show the saved copy straight away, then replace it with fresh data.
    const saved = read<{ at: string; data: T }>(cacheKey);
    queueMicrotask(() => {
      if (alive) setState((s) => ({ key: cacheKey, data: saved?.data ?? (s.key === cacheKey ? s.data : null), at: saved?.at ?? null, fromCache: Boolean(saved), loading: true }));
    });
    void load<T>(path, cacheKey).then((r) => {
      if (!alive) return;
      setState({ key: cacheKey, data: r?.data ?? null, at: r?.at ?? null, fromCache: r?.fromCache ?? false, loading: false });
    });
    return () => {
      alive = false;
    };
  }, [path, cacheKey, version]);
  return state.key === cacheKey ? state : { ...state, data: null, loading: true };
}

// ---- App ---------------------------------------------------------------------------

export function ScoutingApp() {
  const route = useRoute();
  const queueJson = useQueue();
  const queue = useMemo(() => JSON.parse(queueJson) as Op[], [queueJson]);
  const online = useOnline();
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const name = useSyncExternalStore(onNameChange, getName, () => "");
  const [askName, setAskName] = useState(false);
  const boot = useLoad<Boot>("/scouting/api/bootstrap", "boot", version);

  const runSync = useCallback(async () => {
    const r = await sync();
    if (r.sent > 0) setVersion((v) => v + 1);
    if (r.failed.length) setNotice(r.failed[0]);
  }, []);

  // Upload when the page opens, when signal comes back, and every 15s while anything is waiting.
  useEffect(() => {
    const first = setTimeout(() => void runSync(), 0);
    const onOnline = () => void runSync();
    window.addEventListener("online", onOnline);
    const timer = setInterval(() => {
      if (getQueue().length) void runSync();
    }, 15000);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
  }, [runSync]);

  // Keep the page itself working offline.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/scouting-sw.js").catch(() => {});
    }
  }, []);

  const save = (op: Op) => {
    enqueue(op);
    void runSync();
  };

  const b = boot.data;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-3 px-4">
          <button type="button" onClick={() => go({ view: "home" })} className="flex items-center gap-3" aria-label="Scouting home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/hornet.svg" alt="" width={425} height={599} className="h-10 w-auto" />
            <span className="font-display text-xl font-extrabold whitespace-nowrap uppercase sm:text-2xl">
              Scouting<span className="hidden sm:inline">{b ? ` ${b.year}` : ""}</span>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <SyncBadge pending={queue.length} online={online} />
            <button type="button" onClick={() => setAskName(true)} className="flex h-9 max-w-28 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm text-sand hover:border-bone sm:max-w-40">
              <span className="truncate">{name || "Your name"}</span>
              <span aria-hidden="true">✎</span>
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div role="alert" className="mx-auto mt-3 flex w-full max-w-[1100px] items-center gap-3 px-4">
          <p className="grow rounded-md border border-danger/50 bg-danger/10 px-4 py-2 text-sm">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} className="text-sm text-dust hover:text-bone">
            Dismiss
          </button>
        </div>
      )}

      <main id="main" className="mx-auto flex w-full max-w-[1100px] grow flex-col gap-6 px-4 py-6 pb-24">
        {!b ? (
          boot.loading ? (
            <p className="text-dust">Loading…</p>
          ) : (
            <p className="rounded-md border border-line bg-panel p-6 text-sand">
              Couldn&apos;t load scouting, and there&apos;s no saved copy on this phone yet. Open this page once with signal, and it will work offline after that.
            </p>
          )
        ) : !b.open ? (
          <div className="flex flex-col gap-3 rounded-md border border-line bg-panel p-6 md:p-8">
            <h1 className="font-display text-5xl leading-none font-black uppercase">Scouting is closed</h1>
            <p className="text-sand">It opens during build season. Check back after kickoff.</p>
          </div>
        ) : route.view === "home" ? (
          <Home boot={b} />
        ) : route.view === "event" ? (
          <EventView boot={b} eventKey={route.event} version={version} />
        ) : (
          <TeamView
            boot={b}
            team={route.team}
            eventKey={route.event}
            version={version}
            queue={queue}
            name={name}
            requireName={() => setAskName(true)}
            onSave={save}
          />
        )}
      </main>

      {(askName || (b?.open && !name && route.view === "team")) && (
        <NameSheet
          initial={name}
          onDone={(n) => {
            setName(n);
            setAskName(false);
          }}
          onCancel={name ? () => setAskName(false) : undefined}
        />
      )}
    </div>
  );
}

function SyncBadge({ pending, online }: { pending: number; online: boolean }) {
  if (pending > 0)
    return (
      <span className="rounded-full bg-rust px-3 py-1 text-xs font-bold whitespace-nowrap text-white" role="status">
        {pending} <span className="hidden sm:inline">waiting to upload</span>
        <span className="sm:hidden">waiting</span>
      </span>
    );
  if (!online)
    return (
      <span className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold whitespace-nowrap text-dust" role="status">
        Offline
      </span>
    );
  return (
    <span className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold whitespace-nowrap text-dust" role="status">
      <span aria-hidden="true">✓</span> <span className="hidden sm:inline">All saved</span>
      <span className="sm:hidden">Saved</span>
    </span>
  );
}

function StaleNote({ at, fromCache }: { at: string | null; fromCache: boolean }) {
  if (!fromCache || !at) return null;
  return <p className="text-xs text-ash">No connection. Showing the copy saved on this phone {when(at)}.</p>;
}

// ---- Home ----------------------------------------------------------------------------

function Home({ boot }: { boot: Extract<Boot, { open: true }> }) {
  const [number, setNumber] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(number);
          if (Number.isInteger(n) && n > 0) go({ view: "team", team: n, event: null });
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="find-team" className="text-sm font-semibold">
          Find a team
        </label>
        <div className="flex gap-2">
          <input id="find-team" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Team number, e.g. 254" className={input} />
          <button type="submit" className={primary}>
            Go
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow eyebrow-bar text-bone">Our events</h2>
        {boot.events.length === 0 ? (
          <p className="text-sm text-dust">No events for {boot.year} yet. They show up here once 1209 is registered on The Blue Alliance.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {boot.events.map((e) => {
              const now = e.start && e.end && e.start.slice(0, 10) <= today && today <= e.end.slice(0, 10);
              return (
                <li key={e.key}>
                  <button type="button" onClick={() => go({ view: "event", event: e.key })} className="flex w-full flex-col items-start gap-1 rounded-md border border-line bg-panel p-4 text-left hover:border-edge hover:bg-raise">
                    <span className="flex items-center gap-2 font-semibold">
                      {e.name}
                      {now && <span className="rounded bg-rust px-1.5 py-0.5 font-label text-[10px] font-bold text-white">NOW</span>}
                    </span>
                    <span className="text-sm text-dust">{[e.start?.slice(0, 10), e.location].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {boot.scouted.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow eyebrow-bar text-bone">Scouted this season</h2>
          <ul className="flex flex-wrap gap-2">
            {boot.scouted.map((t) => (
              <li key={t.number}>
                <button type="button" onClick={() => go({ view: "team", team: t.number, event: null })} className="flex h-10 items-center gap-2 rounded-md border border-line bg-panel px-3 text-sm hover:border-edge">
                  <span className="font-label font-bold">{t.number}</span>
                  {t.nickname && <span className="max-w-40 truncate text-sand">{t.nickname}</span>}
                  <span className="text-xs text-ash">{t.reports}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ---- Event ---------------------------------------------------------------------------

function EventView({ boot, eventKey, version }: { boot: Extract<Boot, { open: true }>; eventKey: string; version: number }) {
  const { data, loading, at, fromCache } = useLoad<{ key: string; teams: ScoutTeamRow[] }>(`/scouting/api/event/${eventKey}`, `event:${eventKey}`, version);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"number" | "rank">("number");
  const event = boot.events.find((e) => e.key === eventKey);
  const teams = (data?.teams ?? [])
    .filter((t) => !q || String(t.number).startsWith(q) || t.nickname.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "rank" ? (a.rank ?? 999) - (b.rank ?? 999) : a.number - b.number));

  return (
    <>
      <Back to={{ view: "home" }} label="All events" />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-5xl leading-none font-black uppercase">{event?.name ?? eventKey}</h1>
        <p className="text-sm text-dust">{data ? `${data.teams.length} teams` : ""}</p>
        <StaleNote at={at} fromCache={fromCache} />
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number or name" aria-label="Search teams" className={`${input} min-w-48 grow basis-60`} />
        <div role="group" aria-label="Sort" className="flex gap-1 rounded-md border border-line bg-ink p-1">
          {(["number", "rank"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className={`h-10 rounded px-4 text-sm font-semibold ${sort === s ? "bg-bone text-ink" : "text-sand"}`}>
              {s === "number" ? "Number" : "Rank"}
            </button>
          ))}
        </div>
      </div>
      {loading && !data ? (
        <p className="text-dust">Loading teams…</p>
      ) : (data?.teams.length ?? 0) === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-6 text-sm text-dust">
          The Blue Alliance doesn&apos;t have a team list for this event yet. Use Find a team with a number instead.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-panel">
          {teams.map((t) => (
            <li key={t.number}>
              <button type="button" onClick={() => go({ view: "team", team: t.number, event: eventKey })} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-raise">
                <span className="w-16 shrink-0 font-display text-2xl font-extrabold">{t.number}</span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate font-semibold">{t.nickname || "—"}</span>
                  <span className="truncate text-xs text-dust">
                    {[t.rank ? `Rank ${t.rank}` : null, t.record, t.opr !== null ? `OPR ${t.opr.toFixed(1)}` : null].filter(Boolean).join(" · ") || t.city}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {t.hasRobot && <span className="rounded bg-raise px-1.5 py-0.5 font-label text-[10px] font-bold text-sand">ROBOT</span>}
                  {t.reports > 0 && <span className="rounded bg-rust px-1.5 py-0.5 font-label text-[10px] font-bold text-white">{t.reports}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---- Team -----------------------------------------------------------------------------

type Editing = { kind: "robot" } | { kind: "report"; entry: ScoutEntry | null; matchKey: string | null };

function TeamView({
  boot,
  team,
  eventKey,
  version,
  queue,
  name,
  requireName,
  onSave,
}: {
  boot: Extract<Boot, { open: true }>;
  team: number;
  eventKey: string | null;
  version: number;
  queue: Op[];
  name: string;
  requireName: () => void;
  onSave: (op: Op) => void;
}) {
  const path = `/scouting/api/team/${team}${eventKey ? `?event=${eventKey}` : ""}`;
  const { data, loading, at, fromCache } = useLoad<TeamDetail>(path, `team:${team}:${eventKey ?? ""}`, version);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const detail = data ? withQueued(data, queue) : null;
  const { form } = boot;

  if (!detail) {
    return (
      <>
        <Back to={eventKey ? { view: "event", event: eventKey } : { view: "home" }} label={eventKey ? "Teams" : "Home"} />
        <h1 className="font-display text-5xl font-black">{team}</h1>
        <p className="text-dust">{loading ? "Loading…" : "Nothing saved on this phone for this team, and no connection."}</p>
      </>
    );
  }

  const ev = detail.event;
  const matchFor = (key: string | null) => (key ? (ev?.matches.find((m) => m.key === key) ?? null) : null);
  const reportedMatches = new Set(detail.reports.map((r) => r.matchKey).filter(Boolean));
  const start = (e: Editing) => {
    if (!name) return requireName();
    setEditing(e);
  };

  return (
    <>
      <Back to={eventKey ? { view: "event", event: eventKey } : { view: "home" }} label={eventKey ? "Teams" : "Home"} />

      <div className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-baseline gap-x-4 font-display leading-none font-black uppercase">
          <span className="text-6xl">{detail.number}</span>
          <span className="text-3xl text-hornet">{detail.nickname}</span>
        </h1>
        <p className="text-sm text-dust">
          {[detail.city, detail.rookieYear ? `Rookie year ${detail.rookieYear}` : null].filter(Boolean).join(" · ")}
          {" · "}
          <a href={`https://www.thebluealliance.com/team/${detail.number}/${boot.year}`} target="_blank" rel="noopener noreferrer" className="text-hornet hover:text-hornet-hover">
            The Blue Alliance
          </a>
        </p>
        <StaleNote at={at} fromCache={fromCache} />
      </div>

      {detail.events.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Event">
          {detail.events.map((e) => (
            <button key={e.key} type="button" onClick={() => go({ view: "team", team, event: e.key })} aria-pressed={ev?.key === e.key} className={`h-9 rounded-full px-4 text-sm font-semibold ${ev?.key === e.key ? "bg-bone text-ink" : "border border-line-strong text-sand hover:border-bone"}`}>
              {e.name}
            </button>
          ))}
        </div>
      )}

      {ev && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={`Rank at ${ev.name}`} value={ev.rank ? `${ev.rank}${ev.teams ? ` / ${ev.teams}` : ""}` : "—"} />
          <Stat label="Record" value={ev.record ?? "—"} />
          <Stat label="OPR" value={ev.opr !== null ? ev.opr.toFixed(1) : "—"} />
          <Stat label="Matches" value={String(ev.matches.length)} />
          {ev.status && <p className="col-span-2 text-sm text-sand sm:col-span-4">{ev.status}</p>}
        </section>
      )}

      {detail.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {detail.photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={`Team ${detail.number}'s robot`}
              loading="lazy"
              // Offline, or a dead link on TBA: just leave it out.
              onError={(e) => (e.currentTarget.style.display = "none")}
              className="h-40 w-auto shrink-0 rounded-md border border-line object-cover"
            />
          ))}
        </div>
      )}

      <Card
        title="Robot"
        action={
          <button type="button" onClick={() => start({ kind: "robot" })} className={secondary}>
            {detail.robot ? "Edit" : "Add robot info"}
          </button>
        }
      >
        {detail.robot ? (
          <>
            <ScoutingAnswers fields={form.robot} data={detail.robot.data} />
            <p className="text-xs text-ash">
              Last updated by {detail.robot.scouter} {when(detail.robot.updatedAt)}
              {queue.some((q) => q.op === "robot" && q.team === team) ? " · waiting to upload" : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-dust">Nobody has filled this in yet. Ask them about their robot in the pits.</p>
        )}
      </Card>

      <Card
        title={`Match reports (${detail.reports.length})`}
        action={
          <button type="button" onClick={() => start({ kind: "report", entry: null, matchKey: latestPlayed(ev?.matches ?? []) })} className={primary}>
            + Add report
          </button>
        }
      >
        {detail.reports.length > 1 && <Summary form={form} reports={detail.reports} />}
        {detail.reports.length === 0 ? (
          <p className="text-sm text-dust">No reports yet. Watch one of their matches and add one.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.reports.map((r) => {
              const m = matchFor(r.matchKey);
              return (
                <li key={r.clientId} className="flex flex-col gap-3 rounded-md border border-line bg-ink p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold">{m ? m.label : r.matchKey ? r.matchKey.split("_")[1] : "General note"}</span>
                    {m && m.result && <ResultChip match={m} />}
                    <span className="text-xs text-dust">
                      {r.scouter} · {when(r.updatedAt)}
                      {isPending(queue, r.clientId) ? " · waiting to upload" : ""}
                    </span>
                    <span className="ml-auto flex gap-1">
                      {confirmDelete === r.clientId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDelete(null);
                              onSave({ op: "delete", clientId: r.clientId, team, scouter: name || "Anonymous", at: new Date().toISOString() });
                            }}
                            className="h-9 rounded-md bg-danger px-3 text-sm font-bold text-ink"
                          >
                            Delete
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="h-9 rounded-md px-3 text-sm text-sand">
                            Keep
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => start({ kind: "report", entry: r, matchKey: r.matchKey })} className="h-9 rounded-md border border-line-strong px-3 text-sm font-semibold hover:border-bone">
                            Edit
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(r.clientId)} className="h-9 rounded-md px-3 text-sm font-semibold text-danger hover:bg-danger/10">
                            Delete
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  <ScoutingAnswers fields={form.match} data={r.data} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {ev && ev.matches.length > 0 && (
        <Card title={`Their matches at ${ev.name}`}>
          <ul className="flex flex-col divide-y divide-line">
            {ev.matches.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="w-28 shrink-0 font-semibold">{m.label}</span>
                <span className="flex min-w-0 grow flex-wrap gap-x-3 font-label text-sm">
                  <span className={m.alliance === "red" ? "text-[#ff8f8f]" : "text-[#ff8f8f]/60"}>{m.red.join(" ")}</span>
                  <span className="text-ash">vs</span>
                  <span className={m.alliance === "blue" ? "text-[#8fb8ff]" : "text-[#8fb8ff]/60"}>{m.blue.join(" ")}</span>
                </span>
                {m.result ? <ResultChip match={m} /> : <span className="text-xs text-ash">Not played</span>}
                <button
                  type="button"
                  onClick={() => start({ kind: "report", entry: null, matchKey: m.key })}
                  className="h-9 rounded-md border border-line-strong px-3 text-sm font-semibold hover:border-bone"
                >
                  {reportedMatches.has(m.key) ? "✓ Report" : "Report"}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing?.kind === "robot" && (
        <RobotEditor
          team={team}
          form={form}
          current={detail.robot?.data ?? {}}
          onCancel={() => setEditing(null)}
          onSave={(changes) => {
            if (Object.keys(changes).length) onSave({ op: "robot", team, changes, scouter: name, at: new Date().toISOString() });
            setEditing(null);
          }}
        />
      )}
      {editing?.kind === "report" && (
        <ReportEditor
          team={team}
          form={form}
          entry={editing.entry}
          matchKey={editing.matchKey}
          matches={ev?.matches ?? []}
          onCancel={() => setEditing(null)}
          onSave={(matchKey, data) => {
            onSave({
              op: "report",
              clientId: editing.entry?.clientId ?? newId(),
              team,
              eventKey: ev?.key ?? eventKey,
              matchKey,
              data,
              scouter: name,
              at: new Date().toISOString(),
            });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function latestPlayed(matches: ScoutMatch[]) {
  return [...matches].reverse().find((m) => m.result)?.key ?? null;
}

function ResultChip({ match: m }: { match: ScoutMatch }) {
  const score = `${m.redScore}–${m.blueScore}`;
  const cls = m.result === "win" ? "bg-rust text-white" : "bg-raise text-dust";
  return <span className={`rounded px-2 py-0.5 font-label text-xs font-bold ${cls}`}>{`${m.result === "win" ? "W" : m.result === "loss" ? "L" : "T"} ${score}`}</span>;
}

function Summary({ form, reports }: { form: ScoutingForm; reports: ScoutEntry[] }) {
  const rows = form.match
    .filter((f) => f.type !== "section")
    .map((f) => ({ f, text: summarize(f, reports.map((r) => r.data[f.id]).filter((v): v is ScoutingValue => v !== undefined)) }))
    .filter((r) => r.text);
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line-strong bg-raise p-4">
      <h3 className="eyebrow text-[11px] text-ash">Across {reports.length} reports</h3>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(140px,max-content)_1fr]">
        {rows.map(({ f, text }) => (
          <div key={f.id} className="contents">
            <dt className="text-sm text-dust">{f.label}</dt>
            <dd className="text-[15px]">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---- Editors ---------------------------------------------------------------------------

/** A full-screen panel for filling in a form: easier on a phone than a popup. */
function Sheet({ title, children, onCancel, onSave, saveLabel }: { title: string; children: ReactNode; onCancel: () => void; onSave: () => void; saveLabel: string }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[800px] items-center gap-3 px-4">
          <h2 className="grow truncate font-display text-2xl font-extrabold uppercase">{title}</h2>
          <button type="button" onClick={onCancel} className="h-10 rounded-md px-3 text-sm font-semibold text-sand hover:text-bone">
            Cancel
          </button>
        </div>
      </div>
      <div className="grow overflow-y-auto">
        <div className="mx-auto max-w-[800px] px-4 py-6">{children}</div>
      </div>
      <div className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-[800px] justify-end gap-2 px-4 py-3">
          <button type="button" onClick={onSave} className={`${primary} w-full sm:w-auto`}>
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RobotEditor({
  team,
  form,
  current,
  onCancel,
  onSave,
}: {
  team: number;
  form: ScoutingForm;
  current: ScoutingData;
  onCancel: () => void;
  onSave: (changes: Record<string, ScoutingValue | null>) => void;
}) {
  const [data, setData] = useState<ScoutingData>(current);
  return (
    <Sheet
      title={`${team} robot`}
      saveLabel="Save robot info"
      onCancel={onCancel}
      onSave={() => {
        // Only what changed, so someone else's answers from another phone aren't overwritten.
        const changes: Record<string, ScoutingValue | null> = {};
        for (const f of form.robot) {
          const before = JSON.stringify(current[f.id] ?? null);
          const after = JSON.stringify(data[f.id] ?? null);
          if (before !== after) changes[f.id] = data[f.id] ?? null;
        }
        onSave(changes);
      }}
    >
      <FormFields
        fields={form.robot}
        data={data}
        onChange={(id, v) =>
          setData((d) => {
            const next = { ...d };
            if (v === undefined) delete next[id];
            else next[id] = v;
            return next;
          })
        }
      />
    </Sheet>
  );
}

function ReportEditor({
  team,
  form,
  entry,
  matchKey: initialMatch,
  matches,
  onCancel,
  onSave,
}: {
  team: number;
  form: ScoutingForm;
  entry: ScoutEntry | null;
  matchKey: string | null;
  matches: ScoutMatch[];
  onCancel: () => void;
  onSave: (matchKey: string | null, data: ScoutingData) => void;
}) {
  const [matchKey, setMatchKey] = useState<string>(initialMatch ?? "");
  const [data, setData] = useState<ScoutingData>(entry?.data ?? {});
  const known = matches.some((m) => m.key === matchKey);
  return (
    <Sheet title={`${team} ${entry ? "report" : "new report"}`} saveLabel={entry ? "Save changes" : "Save report"} onCancel={onCancel} onSave={() => onSave(matchKey || null, data)}>
      <div className="mb-6 flex flex-col gap-2">
        <label htmlFor="report-match" className="text-[15px] font-semibold">
          Which match?
        </label>
        <select id="report-match" value={matchKey} onChange={(e) => setMatchKey(e.target.value)} className={input}>
          <option value="">General note (not one match)</option>
          {!known && matchKey && <option value={matchKey}>{matchKey}</option>}
          {matches.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
              {m.alliance ? ` · ${m.alliance === "red" ? "Red" : "Blue"}` : ""}
              {m.result ? ` · ${m.redScore}–${m.blueScore}` : ""}
            </option>
          ))}
        </select>
      </div>
      <FormFields
        fields={form.match}
        data={data}
        onChange={(id, v) =>
          setData((d) => {
            const next = { ...d };
            if (v === undefined) delete next[id];
            else next[id] = v;
            return next;
          })
        }
      />
    </Sheet>
  );
}

function NameSheet({ initial, onDone, onCancel }: { initial: string; onDone: (name: string) => void; onCancel?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div role="dialog" aria-modal="true" aria-label="Who's scouting?" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onDone(value.trim().slice(0, 60));
        }}
        className="flex w-full max-w-[420px] animate-rise flex-col gap-4 rounded-lg border border-line-strong bg-panel p-6"
      >
        <h2 className="font-display text-3xl font-extrabold uppercase">Who&apos;s scouting?</h2>
        <p className="text-sm text-dust">Your name goes on what you add, so people know who to ask. It&apos;s remembered on this phone.</p>
        <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder="Your name (and team, if you're a guest)" aria-label="Your name" maxLength={60} className={input} />
        <div className="flex justify-end gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="h-11 rounded-md px-4 text-sm font-semibold text-sand">
              Cancel
            </button>
          )}
          <button type="submit" disabled={!value.trim()} className={primary}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- Bits ------------------------------------------------------------------------------

function Back({ to, label }: { to: Route; label: string }) {
  return (
    <button type="button" onClick={() => go(to)} className="flex items-center gap-1.5 self-start text-sm font-semibold text-hornet hover:text-hornet-hover">
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-md border border-line bg-panel p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl leading-none font-extrabold uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-1 rounded-md border border-line bg-panel p-4">
      <span className="text-xs text-dust">{label}</span>
      <span className="font-display text-3xl leading-none font-extrabold">{value}</span>
    </div>
  );
}
