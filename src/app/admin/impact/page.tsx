import type { Metadata } from "next";
import Link from "next/link";
import { resolveSeasonParam } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { formatDate, seasonLabel } from "@/lib/format";
import { formatHours, getOutreachEvents, getOutreachPeople, getOutreachTotals } from "@/lib/outreach";
import { ShowMore } from "@/components/show-more";
import { AddButton, Badge, LinkRow, RowContent } from "../_components/items";
import { AdminPageHeader, Grid, Panel, TextField } from "../_components/fields";
import { SeasonPicker } from "../_components/season-picker";
import { all } from "@/lib/db";
import { ActionButton } from "../_components/action-form";
import { createOutreachEvent, newsPostToImpact } from "./actions";

export const metadata: Metadata = { title: "Impact events" };

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

export default async function AdminImpactPage(props: PageProps<"/admin/impact">) {
  await requireAdminPage();
  const { season } = await props.searchParams;
  const { year, years } = await resolveSeasonParam(season);
  if (!year) {
    return (
      <>
        <AdminPageHeader title="Impact events" />
        <Panel title="No seasons yet">
          <Link href="/admin/seasons/new" className="font-semibold text-hornet">
            Create a season first
          </Link>
        </Panel>
      </>
    );
  }

  const [totals, events, people, newsPosts] = await Promise.all([
    getOutreachTotals(year),
    getOutreachEvents(year),
    getOutreachPeople(year),
    // Posts from the old News section, which can be turned into impact events.
    all<{ id: number; title: string; published_at: string | null }>("SELECT id, title, published_at FROM posts WHERE category = 'news' AND event_id IS NULL ORDER BY published_at DESC").catch(() => []),
  ]);

  const eventRows = events.map((e) => {
    const past = e.happened === 1;
    return (
      <li key={e.id}>
        <LinkRow href={`/admin/impact/${e.id}`}>
          <RowContent
            opens="page"
            title={e.name}
            meta={`${dates(e.start_date, e.end_date)}${e.location ? ` · ${e.location}` : ""}`}
            badges={
              <>
                {e.hidden === 1 && <Badge tone="muted">Hidden</Badge>}
                {e.story === "published" && <Badge tone="accent">Story</Badge>}
                {e.story === "draft" && <Badge tone="muted">Story draft</Badge>}
                {e.photos > 0 && <Badge tone="muted">{e.photos} photos</Badge>}
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
                  <span className={`font-label text-sm ${past ? "text-hornet" : "text-ash"}`}>{past ? "Log who went" : "Coming up"}</span>
                )}
              </>
            }
          />
        </LinkRow>
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
        title="Impact events"
        description="Demos, school visits, recruiting, camps: everything we do in the community. For each one, log who went and for how long, and if you like, write its story and add photos. The Impact page shows each event and the season's totals, never who went or anyone's own hours."
      />
      <SeasonPicker basePath="/admin/impact" years={years} current={year} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Volunteer hours" value={formatHours(totals.hours)} />
        <Stat label="Impact events" value={totals.events} />
        <Stat label="People reached" value={totals.reached.toLocaleString("en-US")} />
        <Stat label="Team members helped" value={totals.volunteers} />
      </div>

      <Panel
        title={`${seasonLabel(year)} impact events`}
        actions={
          <AddButton
            label="Add impact event"
            title="Add an impact event"
            description="Demos, school visits, camps, community events: anything where we shared FIRST and STEM. Next you'll tick who went, and can write its story and add photos."
            action={createOutreachEvent.bind(null, year)}
            submitLabel="Add event"
          >
            <TextField label="Name" name="name" required placeholder="Demo at Central Library" />
            <Grid>
              <TextField label="Where" name="location" placeholder="Tulsa, OK" />
              <TextField label="Date" name="start_date" type="date" />
              <TextField label="How long (hours)" name="outreach_hours" placeholder="3" hint="What everyone who went gets by default." />
              <TextField label="People reached" name="people_reached" placeholder="150" hint="A rough count is fine. You can add it later." />
            </Grid>
          </AddButton>
        }
        description={
          <>
            Impact events show on the Impact page and the {seasonLabel(year)} season page. Ones with a published story are also on the homepage. Competitions are on{" "}
            <Link href={`/admin/seasons/${year}#events`} className="font-semibold text-hornet hover:text-hornet-hover">
              the season&apos;s page
            </Link>
            .
          </>
        }
      >
        {events.length === 0 ? (
          <p className="text-sm text-dust">No impact events in {seasonLabel(year)} yet. Add one with the button above.</p>
        ) : (
          <ShowMore items={eventRows} initial={8} noun="events" className="flex flex-col gap-2" />
        )}
      </Panel>

      {newsPosts.length > 0 && (
        <Panel
          title="Old news posts"
          description="Written for the News section, which isn't on the site anymore. Turn one into an impact event (in its season, or the current one) to put it on the Impact page with its story."
        >
          <ul className="flex flex-col gap-2">
            {newsPosts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-ink px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.title}</span>
                  <span className="font-label text-xs text-dust">{formatDate(p.published_at) || "No date"}</span>
                </span>
                <ActionButton action={newsPostToImpact.bind(null, p.id)}>Make it an impact event</ActionButton>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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
          <p className="text-sm text-dust">Nobody has been logged for {seasonLabel(year)} yet.</p>
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
