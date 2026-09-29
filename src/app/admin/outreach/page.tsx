import type { Metadata } from "next";
import Link from "next/link";
import { resolveSeasonParam } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatHours, getOutreachEvents, getOutreachPeople, getOutreachTotals } from "@/lib/outreach";
import { ShowMore } from "@/components/show-more";
import { ActionForm } from "../_components/action-form";
import { AdminPageHeader, Grid, Panel, TextField } from "../_components/fields";
import { SeasonPicker } from "../_components/season-picker";
import { createOutreachEvent } from "./actions";

export const metadata: Metadata = { title: "Outreach hours" };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-panel px-5 py-4">
      <span className="font-display text-4xl leading-none font-extrabold tabular-nums">{value}</span>
      <span className="font-label text-xs tracking-wider text-dust uppercase">{label}</span>
    </div>
  );
}

function dates(start: string | null, end: string | null) {
  if (!start) return "No date";
  const a = formatDate(start, { month: "short", day: "numeric" });
  return end && end.slice(0, 10) !== start.slice(0, 10) ? `${a} – ${formatDate(end, { month: "short", day: "numeric" })}` : a;
}

export default async function AdminOutreachPage(props: PageProps<"/admin/outreach">) {
  await requireAdminPage();
  const { season } = await props.searchParams;
  const { year, years } = await resolveSeasonParam(season);
  if (!year) {
    return (
      <>
        <AdminPageHeader title="Outreach hours" />
        <Panel title="No seasons yet">
          <Link href="/admin/seasons/new" className="font-semibold text-hornet">
            Create a season first
          </Link>
        </Panel>
      </>
    );
  }

  const [totals, events, people] = await Promise.all([getOutreachTotals(year), getOutreachEvents(year), getOutreachPeople(year)]);

  const eventRows = events.map((e) => {
    const past = e.happened === 1;
    return (
      <li key={e.id}>
        <Link
          href={`/admin/outreach/${e.id}`}
          className="group flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-line bg-ink px-4 py-3 hover:border-edge"
        >
          <span className="w-28 shrink-0 font-label text-sm text-dust">{dates(e.start_date, e.end_date)}</span>
          <span className="flex min-w-0 grow basis-48 flex-col">
            <span className="font-semibold group-hover:text-hornet">
              {e.name}
              {e.hidden === 1 && <span className="ml-2 rounded bg-raise px-1.5 py-0.5 font-label text-[11px] text-dust">HIDDEN</span>}
            </span>
            {e.location && <span className="truncate text-sm text-dust">{e.location}</span>}
          </span>
          {e.attendees > 0 ? (
            <span className="font-label text-sm text-sand">
              <strong className="text-bone">{e.attendees}</strong> went · <strong className="text-bone">{formatHours(e.hours)}</strong> hrs
              {e.people_reached ? (
                <>
                  {" "}
                  · <strong className="text-bone">{e.people_reached.toLocaleString("en-US")}</strong> reached
                </>
              ) : null}
            </span>
          ) : (
            <span className={`font-label text-sm ${past ? "text-hornet" : "text-ash"}`}>{past ? "Log who went →" : "Coming up"}</span>
          )}
        </Link>
      </li>
    );
  });

  const personRows = people.map((p) => (
    <tr key={p.person_id} className="border-t border-line">
      <td className="px-4 py-2.5">
        <Link href={`/admin/people/${p.person_id}`} className="font-semibold hover:text-hornet">
          {p.first_name} {p.last_name}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-sm text-dust">{p.kind === "mentor" ? "Mentor" : p.graduation_year ? `Class of ${p.graduation_year}` : "Student"}</td>
      <td className="px-4 py-2.5 text-right font-label tabular-nums">{p.events}</td>
      <td className="px-4 py-2.5 text-right font-label font-bold tabular-nums">{formatHours(p.hours)}</td>
    </tr>
  ));

  const csv = (part: string) => `/admin/api/outreach-export?season=${year}&part=${part}`;

  return (
    <>
      <AdminPageHeader
        title="Outreach hours"
        description="Log who went to each outreach event. The Outreach page on the site shows the season's totals (hours, events, people reached), never anyone's own hours."
      />
      <SeasonPicker basePath="/admin/outreach" years={years} current={year} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Volunteer hours" value={formatHours(totals.hours)} />
        <Stat label="Outreach events" value={totals.events} />
        <Stat label="People reached" value={totals.reached.toLocaleString("en-US")} />
        <Stat label="Team members helped" value={totals.volunteers} />
      </div>

      <Panel title="Add an outreach event" description="Demos, school visits, camps, community events: anything where we shared FIRST and STEM.">
        <ActionForm action={createOutreachEvent.bind(null, year)} submitLabel="Add and log who went">
          <Grid cols={3}>
            <TextField label="Name" name="name" required placeholder="Demo at Central Library" className="md:col-span-2" />
            <TextField label="Where" name="location" placeholder="Tulsa, OK" />
            <TextField label="Date" name="start_date" type="date" />
            <TextField label="How long (hours)" name="outreach_hours" placeholder="3" hint="What everyone who went gets by default." />
            <TextField label="People reached" name="people_reached" placeholder="150" hint="A rough count is fine. You can add it later." />
          </Grid>
        </ActionForm>
      </Panel>

      <Panel
        title={`${year} outreach events`}
        description={
          <>
            Outreach events also show on the {year} season page. Competitions and other events are on{" "}
            <Link href={`/admin/seasons/${year}#events`} className="font-semibold text-hornet hover:text-hornet-hover">
              the season&apos;s page
            </Link>
            .
          </>
        }
      >
        {events.length === 0 ? (
          <p className="text-sm text-dust">No outreach events in {year} yet. Add one above.</p>
        ) : (
          <ShowMore items={eventRows} initial={8} noun="events" className="flex flex-col gap-2" />
        )}
      </Panel>

      <Panel
        title="Hours by person"
        description="Only admins see this. Handy for letters of recommendation, service hours and awards."
        actions={
          people.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <a href={csv("people")} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
                Download totals (CSV)
              </a>
              <a href={csv("log")} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
                Download full log (CSV)
              </a>
            </div>
          ) : undefined
        }
      >
        {people.length === 0 ? (
          <p className="text-sm text-dust">Nobody has been logged for {year} yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto md:-mx-6">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="font-label text-xs tracking-wider text-ash uppercase">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium" />
                  <th className="px-4 py-2 text-right font-medium">Events</th>
                  <th className="px-4 py-2 text-right font-medium">Hours</th>
                </tr>
              </thead>
              <ShowMore as="tbody" items={personRows} initial={15} noun="people" columns={4} />
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
