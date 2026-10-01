import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMediaOptions, getSeasonYears, getTbaStatus } from "@/lib/admin-data";
import { getEnv } from "@/lib/cf";
import { getEvents, getRobots, getSeason } from "@/lib/data";
import { formatDate, seasonLabel } from "@/lib/format";
import { tbaConfigured } from "@/lib/tba/client";
import { parseOverrides } from "@/lib/tba/fields";
import { ActionButton } from "../../_components/action-form";
import { EditForm } from "../../_components/unsaved";
import { AdminPageHeader, DeletePanel, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { DocumentField } from "../../_components/document-field";
import { MediaField } from "../../_components/media-field";
import { TbaSyncPanel } from "../../_components/tba-sync-panel";
import { createEvent, deleteSeason, makeCurrentSeason, updateSeason } from "../actions";
import { createRobot } from "../../robots/actions";
import { AddButton, Badge, LinkRow, ModalItem, RowContent } from "../../_components/items";
import { createResource, deleteResource, updateResource } from "../../resources/actions";
import { getSeasonResources, getStoredResources, isScoutingPublished, type StoredResource } from "@/lib/season-extras";
import { MediaImage } from "@/components/media-image";
import { requireAdminPage } from "@/lib/auth";

export async function generateMetadata(props: PageProps<"/admin/seasons/[year]">): Promise<Metadata> {
  return { title: `${seasonLabel(Number((await props.params).year))} season` };
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
  const [robots, events, library, tbaStatus, env, stored, resources, scoutingPublished, years] = await Promise.all([
    getRobots(year),
    getEvents(year, true),
    getMediaOptions(),
    getTbaStatus(),
    getEnv(),
    getStoredResources(year),
    getSeasonResources(year),
    isScoutingPublished(year),
    getSeasonYears(),
  ]);
  // The resources filled in automatically, and where each is changed.
  const autoResources = [
    ...robots.flatMap((r) => [
      ...(r.code_url ? [{ key: `code${r.id}`, title: `${r.name} robot code`, from: `${r.name}'s code link`, source: `/admin/robots/${r.id}` }] : []),
      ...(r.cad_url ? [{ key: `cad${r.id}`, title: `${r.name} CAD`, from: `${r.name}'s CAD link`, source: `/admin/robots/${r.id}` }] : []),
    ]),
    ...(resources.season.some((x) => x.key === "notebook") ? [{ key: "notebook", title: `${seasonLabel(year)} engineering notebook`, from: "Season basics above", source: `/admin/seasons/${year}` }] : []),
    ...(scoutingPublished ? [{ key: "scouting", title: `${seasonLabel(year)} scouting data`, from: "Scouting (shown on the season page)", source: `/admin/scouting?season=${year}` }] : []),
    ...(resources.team.some((x) => x.key === "plan") ? [{ key: "plan", title: "Strategic Plan (every season)", from: "Site text & links", source: "/admin/settings" }] : []),
  ];
  const tbaConnected = tbaConfigured(env);
  const heroMedia = library.find((m) => m.id === season.hero_media_id) ?? null;

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/seasons">Seasons /</Link>}
        title={`${seasonLabel(season.year)} season`}
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
        <EditForm action={updateSeason.bind(null, year)}>
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
            hint="A team or game photo for the homepage (while this is the current season) and the Seasons list. The season page itself leads with the robot's photo slideshow."
          />
          <DocumentField
            name="notebook"
            label="Engineering notebook"
            current={
              season.notebook_media_id && season.notebook_key
                ? { id: season.notebook_media_id, r2_key: season.notebook_key, filename: season.notebook_filename ?? "Notebook.pdf" }
                : null
            }
            currentUrl={season.notebook_url}
            hint="Upload the PDF (up to 95 MB) or paste a link to it. Shown as a button on the season page and listed on the Team page."
          />
        </EditForm>
      </Panel>

      <Panel
        title="Robots"
        description="The first competition robot is featured on the homepage and leads the season page with its photo slideshow. Click a robot for its photos, specs and links."
        actions={
          <AddButton label="Add robot" title="Add a robot" description="Name it now; add photos, specs and links on its page." action={createRobot.bind(null, year)} size="sm">
            <TextField label="Name" name="name" required placeholder="Roomba" />
            <SelectField label="Type" name="kind" defaultValue={robots.some((r) => r.kind === "competition") ? "prototype" : "competition"} options={ROBOT_KINDS} />
          </AddButton>
        }
      >
        <div id="robots" className="flex flex-col gap-2">
          {robots.length === 0 && <p className="text-sm text-dust">No robots yet. Add the {seasonLabel(year)} robot with the button above.</p>}
          {robots.map((r) => (
            <LinkRow key={r.id} href={`/admin/robots/${r.id}`}>
              <RowContent
                opens="page"
                media={<MediaImage mediaKey={r.photo_key} alt="" className="size-12 rounded" sizes="48px" maxWidth={320} placeholder="" />}
                title={r.name}
                meta={ROBOT_KINDS.find((k) => k.value === r.kind)?.label}
                badges={!r.photo_key ? <Badge tone="muted">No photos</Badge> : undefined}
              />
            </LinkRow>
          ))}
        </div>
      </Panel>

      <Panel
        title="Competitions & events"
        description="Events 1209 is registered for come in from The Blue Alliance on their own, with rank, record, awards and every match. Click an event to fix anything or add a write-up."
        actions={
          <AddButton label="Add event" title="Add an event by hand" description="For events The Blue Alliance doesn't list, like scrimmages, demos or outreach." action={createEvent.bind(null, year)} submitLabel="Add event">
            <TextField label="Event name" name="name" required />
            <Grid>
              <SelectField label="Type" name="kind" defaultValue="offseason" options={EVENT_KINDS} />
              <TextField label="Location" name="location" placeholder="Tulsa, OK" />
              <TextField label="Start date" name="start_date" type="date" />
              <TextField label="End date" name="end_date" type="date" />
            </Grid>
          </AddButton>
        }
      >
        <div id="events" className="flex flex-col gap-4">
          <TbaSyncPanel year={year} status={tbaStatus} connected={tbaConnected} />
          {events.length === 0 && (
            <p className="text-sm text-dust">
              No events yet. {tbaConnected ? "Click Sync above to pull them from The Blue Alliance, or add one by hand." : "Add one by hand with the button above."}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {events.map((e) => {
              const edited = parseOverrides(e.overrides).length;
              return (
                <LinkRow key={e.id} href={`/admin/events/${e.id}`}>
                  <RowContent
                    opens="page"
                    title={e.name}
                    meta={`${formatDate(e.start_date) || "No date"}${e.location ? ` · ${e.location}` : ""}${e.rank ? ` · ${e.rank}` : ""}`}
                    badges={
                      <>
                        {e.kind === "outreach" && <Badge>Outreach</Badge>}
                        <Badge tone={e.tba ? "plain" : "muted"}>{e.tba ? "TBA" : "By hand"}</Badge>
                        {edited > 0 && <Badge tone="accent">{edited} edited</Badge>}
                        {e.hidden === 1 && <Badge tone="muted">Hidden</Badge>}
                      </>
                    }
                  />
                </LinkRow>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel
        title="Resources"
        description={
          <>
            The{" "}
            <Link href={`/seasons/${year}/resources`} className="font-semibold text-hornet hover:text-hornet-hover">
              Resources tab
            </Link>{" "}
            of the season page: things other teams (and judges) can use. Some are filled in for you; add anything else as a link or a PDF.
          </>
        }
        actions={
          <AddButton label="Add resource" title="Add a resource" action={createResource.bind(null, year)}>
            <ResourceFields years={years} year={year} />
          </AddButton>
        }
      >
        <div className="flex flex-col gap-2">
          {autoResources.map((r) => (
            <LinkRow key={r.key} href={r.source}>
              <RowContent opens="page" title={r.title} meta={`Filled in from ${r.from}`} badges={<Badge tone="muted">Auto</Badge>} />
            </LinkRow>
          ))}
          {stored.map((r) => (
            <ModalItem
              key={r.id}
              row={
                <RowContent
                  opens="popup"
                  title={r.title}
                  meta={r.r2_key ? r.filename ?? "File" : (r.url ?? "")}
                  badges={r.season_year === null ? <Badge>Every season</Badge> : undefined}
                />
              }
              title="Edit resource"
              description={r.season_year === null ? "A team document: it shows on every season's Resources tab." : undefined}
              action={updateResource.bind(null, r.id, year)}
              destroy={{ label: "Delete resource", confirm: `Delete “${r.title}”?${r.season_year === null ? " It's removed from every season." : ""}`, action: deleteResource.bind(null, r.id) }}
            >
              <ResourceFields resource={r} years={years} year={year} />
            </ModalItem>
          ))}
          {autoResources.length === 0 && stored.length === 0 && <p className="text-sm text-dust">Nothing yet. Add a robot code link, the notebook, or your own resources.</p>}
        </div>
      </Panel>

      <DeletePanel title={`Delete the ${seasonLabel(year)} season`} description="Removes its robots, events, roster entries and resources. Albums and people are kept.">
        <ActionButton
          action={deleteSeason.bind(null, year)}
          variant="danger"
          confirm={`Delete the entire ${seasonLabel(year)} season, including its robots, events and roster entries? Albums and people are kept.`}
        >
          Delete {seasonLabel(year)} season
        </ActionButton>
      </DeletePanel>
    </>
  );
}

function ResourceFields({ resource, years, year }: { resource?: StoredResource; years: number[]; year: number }) {
  return (
    <>
      <TextField label="Title" name="title" defaultValue={resource?.title} required placeholder="Branding guidelines" />
      <TextArea label="Description" name="description" rows={2} defaultValue={resource?.description} hint="One sentence on what it is and who it's for." />
      <DocumentField
        name="link"
        label="File or link"
        current={resource?.media_id && resource.r2_key ? { id: resource.media_id, r2_key: resource.r2_key, filename: resource.filename ?? "File" } : null}
        currentUrl={resource?.url ?? null}
        hint="Upload a PDF, or paste a link to anything else (Google Drive, GitHub, Onshape, YouTube)."
      />
      <SelectField
        label="Shows on"
        name="season"
        defaultValue={resource ? (resource.season_year ?? "all") : year}
        options={[...years.map((y) => ({ value: y, label: `The ${seasonLabel(y)} season` })), { value: "all", label: "Every season (a team document)" }]}
        hint="Every season is for team documents like the branding guidelines."
      />
    </>
  );
}
