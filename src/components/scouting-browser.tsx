"use client";

import { useState } from "react";
import { summarize, type ScoutingField, type ScoutingForm, type ScoutingValue } from "@/lib/scouting";
import type { PublicScouting, PublicTeam } from "@/lib/season-extras";

function answer(field: ScoutingField, value: ScoutingValue | undefined): string | null {
  if (value === undefined || value === null || value === "") return null;
  switch (field.type) {
    case "toggle":
      return value === true ? "Yes" : "No";
    case "rating":
      return `${"★".repeat(Number(value))}${"☆".repeat(Math.max(0, 5 - Number(value)))} ${value}/5`;
    case "number":
      return `${value}${field.unit ? ` ${field.unit}` : ""}`;
    case "multi":
      return Array.isArray(value) ? (value.length ? value.join(", ") : null) : String(value);
    default:
      return String(value);
  }
}

/** Questions and answers, with headings where the form has them. */
function Answers({ fields, data }: { fields: ScoutingField[]; data: Record<string, ScoutingValue> }) {
  const rows: React.ReactNode[] = [];
  let heading: string | null = null;
  for (const f of fields) {
    if (f.type === "section") {
      heading = f.label;
      continue;
    }
    const a = answer(f, data[f.id]);
    if (a === null) continue;
    if (heading) {
      rows.push(
        <dt key={`h-${f.id}`} className="col-span-2 pt-3 font-label text-[11px] tracking-wider text-ash uppercase first:pt-0">
          {heading}
        </dt>,
      );
      heading = null;
    }
    const long = f.type === "longtext" || f.type === "text";
    rows.push(
      <div key={f.id} className={`contents ${long ? "" : ""}`}>
        <dt className={`text-sm text-dust ${long ? "col-span-2" : ""}`}>{f.label}</dt>
        <dd className={`text-sm font-semibold whitespace-pre-line ${long ? "col-span-2 -mt-1 font-normal text-sand" : "text-right"}`}>{a}</dd>
      </div>,
    );
  }
  if (rows.length === 0) return <p className="text-sm text-dust">Nothing filled in.</p>;
  return <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">{rows}</dl>;
}

function TeamCard({ team, form, eventNames }: { team: PublicTeam; form: ScoutingForm; eventNames: Map<string, string> }) {
  const [open, setOpen] = useState(false);
  const questions = form.match.filter((f) => f.type !== "section");
  const summaries = questions
    .map((f) => ({ f, s: summarize(f, team.reports.map((r) => r.data[f.id]).filter((v) => v !== undefined && v !== "")) }))
    .filter((x) => x.s);
  return (
    <li className="rounded-md border border-line bg-panel">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-raise/40 md:px-5">
        <span className="w-16 shrink-0 font-display text-3xl leading-none font-extrabold tabular-nums">{team.number}</span>
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate font-semibold">{team.nickname || `Team ${team.number}`}</span>
          <span className="font-label text-xs text-dust">
            {team.robot ? "Robot sheet" : "No robot sheet"} · {team.reports.length} {team.reports.length === 1 ? "match report" : "match reports"}
          </span>
        </span>
        <span aria-hidden="true" className={`text-dust transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="grid gap-6 border-t border-line p-4 md:grid-cols-2 md:p-5">
          <section className="flex flex-col gap-3">
            <h3 className="font-display text-xl font-bold uppercase">Robot</h3>
            {team.robot ? <Answers fields={form.robot} data={team.robot} /> : <p className="text-sm text-dust">We didn&apos;t fill in a robot sheet for this team.</p>}
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="font-display text-xl font-bold uppercase">Matches</h3>
            {summaries.length > 0 && (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 rounded-md bg-raise/50 p-3">
                {summaries.map(({ f, s }) => (
                  <div key={f.id} className="contents">
                    <dt className="text-sm text-dust">{f.label}</dt>
                    <dd className="text-right text-sm font-semibold">{s}</dd>
                  </div>
                ))}
              </dl>
            )}
            {team.reports.length === 0 ? (
              <p className="text-sm text-dust">No match reports.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {team.reports.map((r, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-md border border-line p-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{r.match}</span>
                      {r.event && <span className="font-label text-xs text-dust">{eventNames.get(r.event) ?? r.event}</span>}
                    </p>
                    <Answers fields={form.match} data={r.data} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </li>
  );
}

/** Every team scouted in a season: search, filter by event, open a team for its sheet and reports. */
export function ScoutingBrowser({ data }: { data: PublicScouting }) {
  const [query, setQuery] = useState("");
  const [event, setEvent] = useState("");
  const [sort, setSort] = useState<"number" | "reports">("number");
  const eventNames = new Map(data.events.map((e) => [e.key, e.name]));
  const q = query.trim().toLowerCase();
  const teams = data.teams
    .filter((t) => !q || String(t.number).startsWith(q) || t.nickname.toLowerCase().includes(q))
    .filter((t) => !event || t.reports.some((r) => r.event === event))
    .sort((a, b) => (sort === "reports" ? b.reports.length - a.reports.length : 0) || a.number - b.number);
  const field = "h-11 rounded-md border border-edge bg-ink px-3 text-[15px] text-bone focus:border-hornet focus:outline-none";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Team number or name" aria-label="Find a team" className={`${field} w-full sm:w-64`} />
        {data.events.length > 1 && (
          <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Event" className={field}>
            <option value="">All events</option>
            {data.events.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as "number" | "reports")} aria-label="Sort" className={field}>
          <option value="number">By team number</option>
          <option value="reports">Most scouted first</option>
        </select>
        <span className="font-label text-sm text-dust sm:ml-auto">
          {teams.length} of {data.teams.length} teams
        </span>
      </div>
      {teams.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-8 text-center text-dust">No teams match.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams.map((t) => (
            <TeamCard key={t.number} team={t} form={data.form} eventNames={eventNames} />
          ))}
        </ul>
      )}
    </div>
  );
}
