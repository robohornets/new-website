import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getEvent, getRoster } from "@/lib/data";
import { all } from "@/lib/db";
import { formatHours } from "@/lib/outreach";
import { ActionButton } from "../../_components/action-form";
import { AdminPageHeader, Grid, Panel, TextArea, TextField } from "../../_components/fields";
import { EditForm } from "../../_components/unsaved";
import { deleteOutreachEvent, saveOutreachEvent } from "../actions";
import { AttendeePicker, type PickerPerson } from "./attendee-picker";

export const metadata: Metadata = { title: "Log outreach" };

export default async function AdminOutreachEventPage(props: PageProps<"/admin/outreach/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const { created } = await props.searchParams;
  const event = Number.isInteger(id) ? await getEvent(id) : null;
  if (!event || event.kind !== "outreach") notFound();

  const [roster, attendance] = await Promise.all([
    getRoster(event.season_year),
    all<{ person_id: number; hours: number | null; first_name: string; last_name: string; kind: "student" | "mentor"; graduation_year: number | null }>(
      `SELECT a.person_id, a.hours, p.first_name, p.last_name, p.kind, p.graduation_year
       FROM outreach_attendance a JOIN people p ON p.id = a.person_id WHERE a.event_id = ?`,
      id,
    ),
  ]);

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
        group: `Not on the ${event.season_year} roster`,
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
            <Link href={`/admin/outreach?season=${event.season_year}`}>Outreach hours</Link> / {event.season_year} /
          </>
        }
        title={event.name}
        description={
          created
            ? "Event added. Now tick who went, then save."
            : "Tick who went. Everyone gets the whole event unless you type their own hours."
        }
        actions={
          <>
            {!event.hidden && (
              <Link
                href={`/seasons/${event.season_year}/events/${event.id}`}
                className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
              >
                View on site
              </Link>
            )}
            <Link
              href={`/admin/events/${event.id}`}
              className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
            >
              Photos, video & more
            </Link>
          </>
        }
      />

      <EditForm action={saveOutreachEvent.bind(null, id)}>
        <Panel title="The event">
          {synced ? (
            <p className="text-sm text-dust">
              The name and dates come from The Blue Alliance; change them on the{" "}
              <Link href={`/admin/events/${event.id}`} className="font-semibold text-hornet hover:text-hornet-hover">
                event&apos;s page
              </Link>
              .
            </p>
          ) : (
            <>
              <TextField label="Name" name="name" defaultValue={event.name} required />
              <Grid cols={3}>
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
          </Grid>
          <TextArea
            label="What we did"
            name="recap"
            rows={3}
            defaultValue={event.recap}
            hint="A sentence or two. Shown on the event's page on the site, and handy for Impact Award write-ups."
          />
        </Panel>

        <Panel title="Who went" description={`Everyone on the ${event.season_year} roster, students and mentors.`}>
          {people.length === 0 ? (
            <p className="text-sm text-dust">
              Nobody is on the {event.season_year} roster yet.{" "}
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

      {!synced && (
        <Panel title="Delete this event">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-dust">Removes the event and everyone&apos;s hours for it. This can&apos;t be undone.</p>
            <ActionButton
              action={deleteOutreachEvent.bind(null, id)}
              variant="danger"
              confirm={`Delete “${event.name}” and the hours logged for it?`}
            >
              Delete event
            </ActionButton>
          </div>
        </Panel>
      )}
    </>
  );
}
