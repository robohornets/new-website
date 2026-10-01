import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { directUploadsEnabled, getSeasonYears } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { FIRST_IMAGE, getEvent, getRoster } from "@/lib/data";
import { all, first } from "@/lib/db";
import { impactPath, seasonLabel } from "@/lib/format";
import { formatHours } from "@/lib/outreach";
import { ActionButton } from "../../_components/action-form";
import { BulkUploader } from "../../_components/bulk-uploader";
import { AdminPageHeader, Checkbox, DeletePanel, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { MarkdownEditor } from "../../_components/markdown-editor";
import { PhotosEditor, type EditorPhoto } from "../../_components/photos-editor";
import { AlbumField, type LibraryAlbum } from "../../_components/library-picker";
import { EditForm } from "../../_components/unsaved";
import { deleteOutreachEvent, ensureEventAlbum, saveOutreachEvent, setEventAlbum } from "../actions";
import { AttendeePicker, type PickerPerson } from "./attendee-picker";

export const metadata: Metadata = { title: "Impact event" };

export default async function AdminImpactEventPage(props: PageProps<"/admin/impact/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const { created } = await props.searchParams;
  const event = Number.isInteger(id) ? await getEvent(id) : null;
  if (!event || event.kind !== "outreach") notFound();

  const [roster, attendance, years] = await Promise.all([
    getRoster(event.season_year),
    all<{ person_id: number; hours: number | null; first_name: string; last_name: string; kind: "student" | "mentor"; graduation_year: number | null }>(
      `SELECT a.person_id, a.hours, p.first_name, p.last_name, p.kind, p.graduation_year
       FROM outreach_attendance a JOIN people p ON p.id = a.person_id WHERE a.event_id = ?`,
      id,
    ),
    getSeasonYears(),
  ]);
  const [direct, album, photos] = await Promise.all([
    directUploadsEnabled(),
    event.album_id
      ? first<LibraryAlbum & { cover_media_id: number | null; published: number }>(
          `SELECT a.id, a.title, a.season_year, a.cover_media_id, a.published,
              (SELECT COUNT(*) FROM album_photos ap WHERE ap.album_id = a.id) AS photos,
              (SELECT mi.r2_key FROM media mi WHERE mi.id = COALESCE(a.cover_media_id, ${FIRST_IMAGE})) AS cover_key
       FROM albums a WHERE a.id = ?`,
          event.album_id,
        )
      : null,
    event.album_id
      ? all<EditorPhoto>(
          `SELECT ap.media_id, m.r2_key, m.alt, m.filename, ap.caption FROM album_photos ap JOIN media m ON m.id = ap.media_id
           WHERE ap.album_id = ? ORDER BY ap.sort_order, m.created_at`,
          event.album_id,
        )
      : [],
  ]);
  const season = seasonLabel(event.season_year);

  const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.trim();
  const byName = (a: PickerPerson, b: PickerPerson) => a.name.localeCompare(b.name);
  const onRoster = new Set(roster.map((m) => m.id));
  const people: PickerPerson[] = [
    ...roster
      .filter((m) => m.kind === "student")
      .map((m) => ({
        id: m.id,
        name: fullName(m),
        detail: [m.subteam, m.graduation_year ? `Class of ${m.graduation_year}` : ""].filter(Boolean).join(" · "),
        group: "Students",
      }))
      .sort(byName),
    ...roster
      .filter((m) => m.kind === "mentor")
      .map((m) => ({ id: m.id, name: fullName(m), detail: m.role === "Member" ? "" : m.role, group: "Mentors" }))
      .sort(byName),
    // Logged before being taken off this season's roster: keep them so saving doesn't drop them.
    ...attendance
      .filter((a) => !onRoster.has(a.person_id))
      .map((a) => ({
        id: a.person_id,
        name: fullName(a),
        detail: a.kind === "mentor" ? "Mentor" : a.graduation_year ? `Class of ${a.graduation_year}` : "",
        group: `Not on the ${season} roster`,
      }))
      .sort(byName),
  ];
  const logged = Object.fromEntries(attendance.map((a) => [a.person_id, a.hours]));
  const synced = Boolean(event.tba);

  return (
    <>
      <AdminPageHeader
        breadcrumb={
          <>
            <Link href={`/admin/impact?season=${event.season_year}`}>Impact events</Link> / {season} /
          </>
        }
        title={event.name}
        description={
          created
            ? "Event added. Tick who went and save. Writing its story and adding photos are up to you."
            : "Log who went, and if you like, write its story and add photos. Everything but the photos saves from the bar at the bottom."
        }
        actions={
          <>
            {!event.hidden && (
              <Link href={impactPath(event)} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
                View on site
              </Link>
            )}
            {synced && (
              <Link href={`/admin/events/${event.id}`} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
                Blue Alliance details
              </Link>
            )}
          </>
        }
      />

      <EditForm action={saveOutreachEvent.bind(null, id)}>
        <Panel title="The event">
          {synced ? (
            <p className="text-sm text-dust">
              The name and dates come from The Blue Alliance; change them under{" "}
              <Link href={`/admin/events/${event.id}`} className="font-semibold text-hornet hover:text-hornet-hover">
                Blue Alliance details
              </Link>
              .
            </p>
          ) : (
            <>
              <Grid cols={4}>
                <TextField label="Name" name="name" defaultValue={event.name} required />
                <TextField label="Date" name="start_date" type="date" defaultValue={event.start_date?.slice(0, 10)} />
                <TextField label="Last day" name="end_date" type="date" defaultValue={event.end_date?.slice(0, 10)} hint="Only for events over more than one day." />
                <TextField label="Where" name="location" defaultValue={event.location} />
              </Grid>
            </>
          )}
          <Grid cols={3}>
            <TextField
              label="How long (hours)"
              name="outreach_hours"
              defaultValue={event.outreach_hours == null ? "" : formatHours(event.outreach_hours)}
              placeholder="3"
              hint="What everyone who went gets, unless you give them their own hours."
            />
            <TextField
              label="People reached"
              name="people_reached"
              defaultValue={event.people_reached}
              placeholder="150"
              hint="A rough count of the public we talked to or who saw the demo."
            />
            {!event.tba_key && (
              <SelectField
                label="Season"
                name="season_year"
                defaultValue={event.season_year}
                options={years.map((y) => ({ value: y, label: `${seasonLabel(y)} season` }))}
                hint="Its hours count toward that season."
              />
            )}
          </Grid>
          <Checkbox
            label="Hide this event from the site"
            name="hidden"
            defaultChecked={event.hidden === 1}
            hint="It still counts toward the hours here. Its photos are hidden from the Gallery too."
          />
        </Panel>

        <Panel
          title="Story"
          description="Optional. The summary shows on the event's card; write an article too and it gets its own story, also shown on the homepage."
        >
          <TextArea
            label="What we did"
            name="recap"
            rows={3}
            defaultValue={event.recap}
            hint="A sentence or two, shown on the Impact page and at the top of the event's page. Handy for Impact Award write-ups."
          />
          <MarkdownEditor name="story" label="Article" defaultValue={event.story} />
          <Grid>
            <Checkbox
              label="Publish the article"
              name="story_published"
              defaultChecked={event.story_published === 1}
              hint="Leave it off while it's a draft; the event still shows without it."
            />
            <TextField
              label="Video"
              name="highlight_video_url"
              type="url"
              defaultValue={event.highlight_video_url}
              placeholder="https://youtube.com/watch?v=…"
              hint="A YouTube link or a video from the Media library, shown on the event's page."
            />
          </Grid>
        </Panel>

        <Panel title="Who went" description={`Everyone on the ${season} roster, students and mentors.`}>
          {people.length === 0 ? (
            <p className="text-sm text-dust">
              Nobody is on the {season} roster yet.{" "}
              <Link href={`/admin/roster?season=${event.season_year}`} className="font-semibold text-hornet hover:text-hornet-hover">
                Add the roster first
              </Link>
              .
            </p>
          ) : (
            <AttendeePicker people={people} logged={logged} eventHours={event.outreach_hours} />
          )}
        </Panel>
      </EditForm>

      <Panel
        title="Photos"
        description={
          <>
            The main photo leads the event&apos;s card and page; the rest show in a gallery at the end of its page.
            {album && (
              <>
                {" "}They&apos;re the album{" "}
                <Link href={`/admin/gallery/${album.id}`} className="font-semibold text-hornet hover:text-hornet-hover">
                  {album.title}
                </Link>
                {album.published ? ", which also shows in the Gallery." : " (hidden from the Gallery)."}
              </>
            )}
          </>
        }
      >
        <BulkUploader albumId={album?.id} ensureAlbum={album ? undefined : ensureEventAlbum.bind(null, id)} label="Add photos of this event" direct={direct} />
        <EditForm key={event.album_id ?? "none"} action={setEventAlbum.bind(null, id)}>
          <AlbumField
            name="album_id"
            current={album}
            noneLabel="Its own album, made when you upload above"
            hint="Already have the photos in an album? Use it instead of uploading them again."
          />
        </EditForm>
        {album && photos.length > 0 && <PhotosEditor albumId={album.id} coverId={album.cover_media_id} photos={photos} coverLabel="Make main photo" />}
      </Panel>

      {!synced && (
        <DeletePanel title="Delete this event" description="Removes the event, its story and everyone's hours for it. Its photo album stays in the Gallery. This can't be undone.">
          <ActionButton action={deleteOutreachEvent.bind(null, id)} variant="danger" confirm={`Delete “${event.name}” and the hours logged for it?`}>
            Delete event
          </ActionButton>
        </DeletePanel>
      )}
    </>
  );
}
