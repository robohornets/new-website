import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getEvent, getMatches } from "@/lib/data";
import { all } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { EVENT_TBA_FIELDS, MATCH_TBA_FIELDS, parseOverrides, parseTba } from "@/lib/tba/fields";
import { matchLabel } from "@/lib/tba/map";
import type { Match } from "@/lib/types";
import { ActionButton, ActionForm } from "../../_components/action-form";
import { AdminPageHeader, Checkbox, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { TbaField } from "../../_components/tba-field";
import {
  createMatch,
  deleteEvent,
  deleteMatch,
  resetAllEventFields,
  resetEventField,
  resetMatchField,
  setMatchesHidden,
  syncEventFromTba,
  updateEvent,
  updateMatch,
} from "../actions";

export const metadata: Metadata = { title: "Edit event" };

const EVENT_KINDS = [
  { value: "regional", label: "Regional" },
  { value: "district", label: "District event" },
  { value: "championship", label: "Championship" },
  { value: "offseason", label: "Offseason event" },
  { value: "outreach", label: "Outreach / demo" },
  { value: "other", label: "Other" },
];

const RESULTS = [
  { value: "", label: "Not played yet" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "tie", label: "Tie" },
];

const LEVELS = [
  { value: "qm", label: "Qualification" },
  { value: "ef", label: "Eighthfinal" },
  { value: "qf", label: "Quarterfinal" },
  { value: "sf", label: "Semifinal / playoff round" },
  { value: "f", label: "Final" },
];

const HINTS: Partial<Record<string, string>> = {
  rank: 'Like "Rank 8 of 48".',
  record: 'Wins-losses-ties in qualification matches, like "7-3-0".',
  alliance: 'Like "Captain, Alliance 3" or "1st pick, Alliance 2". Leave empty if we weren\'t picked.',
  playoff_result: 'Like "Event winners" or "Eliminated in semifinals".',
  awards: "Separate awards with commas.",
  webcast_url: "Shown as a Watch live button on the homepage while the event is on.",
};

export default async function AdminEventPage(props: PageProps<"/admin/events/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const { created } = await props.searchParams;
  const event = Number.isInteger(id) ? await getEvent(id) : null;
  if (!event) notFound();
  const [matches, albums] = await Promise.all([
    getMatches(id, true),
    all<{ id: number; title: string; season_year: number | null }>(
      "SELECT id, title, season_year FROM albums ORDER BY season_year = ? DESC, season_year DESC, created_at DESC",
      event.season_year,
    ),
  ]);
  const synced = Boolean(event.tba);
  const tba = parseTba(event.tba);
  const overrides = parseOverrides(event.overrides);
  const values = event as unknown as Record<string, string | number | null>;
  const publicUrl = `/seasons/${event.season_year}/events/${event.id}`;

  return (
    <>
      <AdminPageHeader
        breadcrumb={
          <>
            <Link href="/admin/seasons">Seasons</Link> / <Link href={`/admin/seasons/${event.season_year}#events`}>{event.season_year}</Link> /
          </>
        }
        title={event.name}
        description={
          created
            ? "Event added. Fill in anything else below."
            : synced
              ? `From The Blue Alliance (${event.tba_key}). Last synced ${formatDateTime(event.tba_synced_at) || "not yet"}.`
              : "Added by hand. Nothing here is synced."
        }
        actions={
          <>
            {!event.hidden && (
              <Link href={publicUrl} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
                View on site
              </Link>
            )}
            {event.tba_key && (
              <ActionButton action={syncEventFromTba.bind(null, id)} variant="primary">
                Sync from TBA now
              </ActionButton>
            )}
          </>
        }
      />

      {overrides.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-rust bg-rust/15 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            <strong className="text-hornet">{overrides.length} field{overrides.length === 1 ? " uses" : "s use"} your own value</strong>{" "}
            instead of The Blue Alliance&apos;s: {overrides.map((f) => EVENT_TBA_FIELDS.find((x) => x.name === f)?.label ?? f).join(", ")}.
          </span>
          <form action={resetAllEventFields.bind(null, id)}>
            <button type="submit" className="flex h-10 items-center rounded-md border border-rust px-4 text-sm font-semibold text-hornet hover:bg-rust/20">
              Reset all to TBA
            </button>
          </form>
        </div>
      )}

      <ActionForm action={updateEvent.bind(null, id)} submitLabel="Save event">
        <Panel
          title="Results & details"
          description={
            synced
              ? "These come from The Blue Alliance. Change any box to override it; the site then shows your value and syncing leaves it alone. Reset puts TBA's value back."
              : "Type in the details for this event."
          }
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {EVENT_TBA_FIELDS.map((f) => (
              <TbaField
                key={f.name}
                name={f.name}
                label={f.label}
                type={"type" in f ? f.type : "text"}
                value={values[f.name]}
                tbaValue={tba[f.name]}
                synced={synced}
                overridden={overrides.includes(f.name)}
                reset={resetEventField.bind(null, id, f.name)}
                hint={HINTS[f.name]}
                options={f.name === "kind" ? EVENT_KINDS : undefined}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Extras on the event page" description="Only you add these. The Blue Alliance never changes them.">
          <TextArea
            label="Write-up"
            name="recap"
            rows={5}
            defaultValue={event.recap}
            hint="A short recap of how the event went. Shown near the top of the event page."
          />
          <Grid>
            <TextField
              label="Highlight video"
              name="highlight_video_url"
              type="url"
              defaultValue={event.highlight_video_url}
              placeholder="https://youtube.com/watch?v=…"
              hint="A YouTube link or a video from the Media library. Plays at the top of the event page."
            />
            <SelectField
              label="Photo album"
              name="album_id"
              defaultValue={event.album_id ?? ""}
              options={[
                { value: "", label: "No album" },
                ...albums.map((a) => ({ value: a.id, label: `${a.title}${a.season_year ? ` (${a.season_year})` : ""}` })),
              ]}
              hint="Photos from this album show on the event page. Make albums under Gallery."
            />
          </Grid>
          <Checkbox
            label="Hide this event from the site"
            name="hidden"
            defaultChecked={event.hidden === 1}
            hint="It keeps syncing here, it just won't show publicly."
          />
          <Grid>
            <TextField
              label="Blue Alliance key"
              name="tba_key"
              defaultValue={event.tba_key}
              placeholder="2027okok"
              hint="Usually filled in for you. It's the last part of the event's TBA web address."
            />
            <TextArea label="Private notes" name="notes" rows={2} defaultValue={event.notes} hint="Only admins see these." />
          </Grid>
        </Panel>
      </ActionForm>

      <Panel
        title={`Matches (${matches.length})`}
        description={
          synced
            ? "Every match 1209 played here, from The Blue Alliance. Open one to fix the score, add our own video, or hide it."
            : "Add matches by hand if you want them on the event page."
        }
        actions={
          matches.length > 0 ? (
            <div className="flex gap-2">
              <ActionButton action={setMatchesHidden.bind(null, id, true)}>Hide all</ActionButton>
              <ActionButton action={setMatchesHidden.bind(null, id, false)}>Show all</ActionButton>
            </div>
          ) : undefined
        }
      >
        <ul className="flex flex-col gap-2">
          {matches.map((m) => (
            <MatchItem key={m.id} match={m} />
          ))}
        </ul>
        <details className="rounded-md border border-dashed border-edge">
          <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-hornet">+ Add a match by hand</summary>
          <div className="border-t border-line p-4">
            <ActionForm action={createMatch.bind(null, id)} submitLabel="Add match" resetOnSuccess>
              <Grid cols={4}>
                <SelectField label="Round" name="comp_level" defaultValue="qm" options={LEVELS} />
                <TextField label="Set" name="set_number" type="number" defaultValue={1} hint="Playoff series number; 1 for quals." />
                <TextField label="Match number" name="match_number" type="number" defaultValue={matches.length + 1} />
                <SelectField label="Our alliance" name="our_alliance" defaultValue="red" options={[{ value: "red", label: "Red" }, { value: "blue", label: "Blue" }]} />
                <TextField label="Red teams" name="red_teams" placeholder="1209, 254, 1678" />
                <TextField label="Blue teams" name="blue_teams" placeholder="118, 148, 2056" />
                <TextField label="Red score" name="red_score" type="number" />
                <TextField label="Blue score" name="blue_score" type="number" />
                <SelectField label="Our result" name="result" defaultValue="" options={RESULTS} />
                <TextField label="Video link" name="video_url" type="url" className="md:col-span-3" />
              </Grid>
            </ActionForm>
          </div>
        </details>
      </Panel>

      <Panel title="Danger zone">
        <p className="text-sm text-dust">
          {event.tba_key
            ? "Events from The Blue Alliance come back on the next sync if deleted. To take one off the site, tick “Hide this event” above instead."
            : "Deleting removes the event and its matches."}
        </p>
        <ActionButton action={deleteEvent.bind(null, id)} variant="danger" confirm={`Delete ${event.name} and all its matches?`}>
          Delete event
        </ActionButton>
      </Panel>
    </>
  );
}

function MatchItem({ match: m }: { match: Match }) {
  const synced = Boolean(m.tba);
  const tba = parseTba(m.tba);
  const overrides = parseOverrides(m.overrides);
  const values = m as unknown as Record<string, string | number | null>;
  const scored = m.red_score !== null && m.blue_score !== null;
  const resultColor = m.result === "win" ? "text-hornet" : m.result === "loss" ? "text-dust" : "text-sand";
  return (
    <li>
      <details className="group rounded-md border border-line bg-ink">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
          <span className="w-32 font-semibold">{matchLabel(m)}</span>
          <span className="font-label text-xs text-dust">
            <span className="text-[#ff8f8f]">{m.red_teams || "—"}</span> vs <span className="text-[#8fb8ff]">{m.blue_teams || "—"}</span>
          </span>
          <span className="font-label">{scored ? `${m.red_score}–${m.blue_score}` : "—"}</span>
          {m.result && <span className={`font-label text-xs uppercase ${resultColor}`}>{m.result}</span>}
          {m.video_url && <span className="font-label text-[10px] text-dust">VIDEO</span>}
          {overrides.length > 0 && <span className="rounded bg-rust px-1.5 py-0.5 font-label text-[10px] font-bold text-white">EDITED</span>}
          {m.hidden === 1 && <span className="rounded bg-raise px-1.5 py-0.5 font-label text-[10px] text-dust">HIDDEN</span>}
          <span className="ml-auto text-hornet group-open:hidden">Edit</span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-line p-3">
          <ActionForm action={updateMatch.bind(null, m.id)} submitLabel="Save match" submitVariant="secondary">
            {!synced && (
              <Grid cols={4}>
                <SelectField label="Round" name="comp_level" defaultValue={m.comp_level} options={LEVELS} />
                <TextField label="Set" name="set_number" type="number" defaultValue={m.set_number} />
                <TextField label="Match number" name="match_number" type="number" defaultValue={m.match_number} />
                <SelectField label="Our alliance" name="our_alliance" defaultValue={m.our_alliance ?? "red"} options={[{ value: "red", label: "Red" }, { value: "blue", label: "Blue" }]} />
              </Grid>
            )}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {MATCH_TBA_FIELDS.map((f) => (
                <TbaField
                  key={f.name}
                  name={f.name}
                  label={f.label}
                  type={"type" in f ? f.type : "text"}
                  value={values[f.name]}
                  tbaValue={tba[f.name]}
                  synced={synced}
                  overridden={overrides.includes(f.name)}
                  reset={resetMatchField.bind(null, m.id, f.name)}
                  options={f.name === "result" ? RESULTS : undefined}
                  hint={f.name === "video_url" ? "Swap in our own robot-cam video or a different YouTube link." : f.name.endsWith("_teams") ? "Team numbers, separated by commas." : undefined}
                />
              ))}
            </div>
            <Checkbox label="Hide this match from the site" name="hidden" defaultChecked={m.hidden === 1} />
          </ActionForm>
          {!synced && (
            <div className="border-t border-line pt-3">
              <ActionButton action={deleteMatch.bind(null, m.id)} variant="danger" confirm="Delete this match?">
                Delete match
              </ActionButton>
            </div>
          )}
          {m.time && <span className="text-xs text-ash">Played {formatDate(new Date(m.time * 1000).toISOString())}</span>}
        </div>
      </details>
    </li>
  );
}
