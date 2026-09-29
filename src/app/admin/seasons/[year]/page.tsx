import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { specsToText } from "@/lib/admin";
import { getMediaOptions, getTbaStatus } from "@/lib/admin-data";
import { getEnv } from "@/lib/cf";
import { getEvents, getRobots, getSeason } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { tbaConfigured } from "@/lib/tba/client";
import { parseOverrides } from "@/lib/tba/fields";
import type { Robot } from "@/lib/types";
import { ActionButton, ActionForm } from "../../_components/action-form";
import { AdminPageHeader, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { MediaField, type MediaOption } from "../../_components/media-field";
import { TbaSyncPanel } from "../../_components/tba-sync-panel";
import {
  createEvent,
  createRobot,
  deleteRobot,
  deleteSeason,
  makeCurrentSeason,
  updateRobot,
  updateSeason,
} from "../actions";
import { requireAdminPage } from "@/lib/auth";

export async function generateMetadata(props: PageProps<"/admin/seasons/[year]">): Promise<Metadata> {
  return { title: `${(await props.params).year} season` };
}

const ROBOT_KINDS = [
  { value: "competition", label: "Competition robot" },
  { value: "kitbot", label: "Kitbot" },
  { value: "offseason", label: "Offseason robot" },
  { value: "prototype", label: "Prototype" },
];

const EVENT_KINDS = [
  { value: "regional", label: "Regional" },
  { value: "district", label: "District event" },
  { value: "championship", label: "Championship" },
  { value: "offseason", label: "Offseason event" },
  { value: "outreach", label: "Outreach / demo" },
  { value: "other", label: "Other" },
];

export default async function AdminSeasonPage(props: PageProps<"/admin/seasons/[year]">) {
  await requireAdminPage();
  const year = Number((await props.params).year);
  const season = Number.isInteger(year) ? await getSeason(year) : null;
  if (!season) notFound();
  const [robots, events, library, tbaStatus, env] = await Promise.all([
    getRobots(year),
    getEvents(year, true),
    getMediaOptions(),
    getTbaStatus(),
    getEnv(),
  ]);
  const tbaConnected = tbaConfigured(env);
  const heroMedia = library.find((m) => m.id === season.hero_media_id) ?? null;

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/seasons">Seasons /</Link>}
        title={`${season.year} season`}
        description={season.is_current ? "This is the current season shown on the homepage." : "Archived season."}
        actions={
          <>
            <Link
              href={`/seasons/${year}`}
              className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
            >
              View page
            </Link>
            <Link
              href={`/admin/roster?season=${year}`}
              className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
            >
              Roster
            </Link>
            <Link
              href={`/admin/sponsors?season=${year}`}
              className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
            >
              Sponsors
            </Link>
            {!season.is_current && (
              <ActionButton action={makeCurrentSeason.bind(null, year)} variant="primary">
                Make current season
              </ActionButton>
            )}
          </>
        }
      />

      <Panel title="Season basics">
        <ActionForm action={updateSeason.bind(null, year)}>
          <Grid>
            <TextField label="Game name" name="game_name" defaultValue={season.game_name} />
            <SelectField
              label="Status"
              name="status"
              defaultValue={season.status}
              options={[
                { value: "pre_kickoff", label: "Pre-kickoff" },
                { value: "build", label: "Build season" },
                { value: "competition", label: "Competition season" },
                { value: "offseason", label: "Offseason" },
              ]}
              hint="Shown as a badge on the homepage season card."
            />
            <TextField label="Kickoff date" name="kickoff_date" type="date" defaultValue={season.kickoff_date} />
            <TextField label="Game reveal video" name="reveal_video_url" type="url" defaultValue={season.reveal_video_url} />
          </Grid>
          <TextArea label="Season summary" name="summary" rows={5} defaultValue={season.summary} hint="Shown at the top of the season page." />
          <MediaField
            name="hero_media_id"
            label="Season photo"
            current={heroMedia}
            library={library}
            hint="Used as the homepage hero while this is the current season. Falls back to the robot photo."
          />
        </ActionForm>
      </Panel>

      <Panel title="Robots" description="The first competition robot is featured on the homepage and season page.">
        <div id="robots" className="flex flex-col gap-3">
          {robots.map((r) => (
            <details key={r.id} className="group rounded-md border border-line bg-ink">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                <span className="flex items-baseline gap-3">
                  <span className="font-display text-2xl font-extrabold uppercase">{r.name}</span>
                  <span className="font-mono text-xs text-dust uppercase">{r.kind}</span>
                </span>
                <span className="text-sm text-hornet group-open:hidden">Edit</span>
                <span className="hidden text-sm text-dust group-open:inline">Close</span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-line p-4">
                <RobotForm robot={r} library={library} />
                <div className="border-t border-line pt-4">
                  <ActionButton action={deleteRobot.bind(null, r.id)} variant="danger" confirm={`Delete ${r.name}? This can't be undone.`}>
                    Delete robot
                  </ActionButton>
                </div>
              </div>
            </details>
          ))}
          <div className="rounded-md border border-dashed border-edge">
            <h3 className="px-4 py-3 font-semibold text-hornet">+ Add {robots.length ? "another" : "a"} robot</h3>
            <div className="border-t border-line p-4">
              <RobotForm library={library} year={year} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Competitions & events"
        description="Events 1209 is registered for come in from The Blue Alliance on their own, with rank, record, awards and every match. Click an event to fix anything or add a write-up."
      >
        <div id="events" className="flex flex-col gap-4">
          <TbaSyncPanel year={year} status={tbaStatus} connected={tbaConnected} />
          {events.length === 0 && (
            <p className="text-sm text-dust">
              No events yet.{" "}
              {tbaConnected ? "Click Sync above to pull them from The Blue Alliance, or add one by hand below." : "Add one by hand below."}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {events.map((e) => {
              const edited = parseOverrides(e.overrides).length;
              return (
                <li key={e.id}>
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-ink px-4 py-3 hover:border-edge"
                  >
                    <span className="flex min-w-0 grow flex-col gap-0.5">
                      <span className="font-semibold">{e.name}</span>
                      <span className="font-mono text-xs text-dust">
                        {formatDate(e.start_date) || "No date"}
                        {e.location ? ` · ${e.location}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      {e.rank && <span className="font-mono text-amber">{e.rank}</span>}
                      {e.playoff_result && <span className="text-sand">{e.playoff_result}</span>}
                      {e.tba ? (
                        <span className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-sand">TBA</span>
                      ) : (
                        <span className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-dust">BY HAND</span>
                      )}
                      {edited > 0 && <span className="rounded bg-amber px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink">{edited} EDITED</span>}
                      {e.hidden === 1 && <span className="rounded bg-raise px-1.5 py-0.5 font-mono text-[10px] text-dust">HIDDEN</span>}
                    </span>
                    <span className="text-sm font-semibold text-hornet">Open</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <details className="rounded-md border border-dashed border-edge">
            <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-hornet">+ Add an event by hand</summary>
            <div className="flex flex-col gap-3 border-t border-line p-4">
              <p className="text-sm text-dust">For events The Blue Alliance doesn&apos;t list, like scrimmages, demos or outreach.</p>
              <NewEventForm year={year} />
            </div>
          </details>
        </div>
      </Panel>

      <Panel title="Danger zone">
        <ActionButton
          action={deleteSeason.bind(null, year)}
          variant="danger"
          confirm={`Delete the entire ${year} season, including its robots, events and roster entries? Posts, albums and people are kept.`}
        >
          Delete {year} season
        </ActionButton>
      </Panel>
    </>
  );
}

function RobotForm({ robot, library, year }: { robot?: Robot; library: MediaOption[]; year?: number }) {
  const action = robot ? updateRobot.bind(null, robot.id) : createRobot.bind(null, year!);
  return (
    <ActionForm action={action} submitLabel={robot ? "Save robot" : "Add robot"} resetOnSuccess={!robot}>
      <Grid cols={3}>
        <TextField label="Name" name="name" defaultValue={robot?.name} required />
        <SelectField label="Type" name="kind" defaultValue={robot?.kind ?? "competition"} options={ROBOT_KINDS} />
        <TextField label="Order" name="sort_order" type="number" defaultValue={robot?.sort_order ?? 0} hint="Lower shows first." />
      </Grid>
      <TextArea label="Description" name="description" rows={3} defaultValue={robot?.description} />
      <Grid>
        <TextArea
          label="Specs"
          name="specs"
          rows={5}
          mono
          defaultValue={robot ? specsToText(robot.specs) : ""}
          placeholder={"Drivetrain: Swerve, 8 × Kraken X60\nAutonomous: PathPlanner"}
          hint="One per line, as Label: value"
        />
        <div className="flex flex-col gap-4">
          <TextField label="Tags" name="tags" defaultValue={robot?.tags.join(", ")} hint="Comma separated, e.g. Swerve, Elevator" />
          <TextField label="Code link" name="code_url" type="url" defaultValue={robot?.code_url} placeholder="https://github.com/robohornets/…" />
          <TextField label="CAD link" name="cad_url" type="url" defaultValue={robot?.cad_url} />
        </div>
      </Grid>
      <MediaField
        name="photo_media_id"
        label="Robot photo"
        current={library.find((m) => m.id === robot?.photo_media_id) ?? null}
        library={library}
      />
    </ActionForm>
  );
}

function NewEventForm({ year }: { year: number }) {
  return (
    <ActionForm action={createEvent.bind(null, year)} submitLabel="Add event">
      <Grid cols={3}>
        <TextField label="Event name" name="name" required className="md:col-span-2" />
        <SelectField label="Type" name="kind" defaultValue="offseason" options={EVENT_KINDS} />
        <TextField label="Location" name="location" placeholder="Tulsa, OK" />
        <TextField label="Start date" name="start_date" type="date" />
        <TextField label="End date" name="end_date" type="date" />
      </Grid>
      <TextField
        label="Blue Alliance key (optional)"
        name="tba_key"
        placeholder="2027okok"
        hint="Only if the event is on TBA but hasn't shown up yet. It's the last part of the event's TBA web address."
        className="md:max-w-sm"
      />
    </ActionForm>
  );
}
