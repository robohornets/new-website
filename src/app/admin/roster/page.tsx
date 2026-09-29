import type { Metadata } from "next";
import Link from "next/link";
import { getMediaOptions, resolveSeasonParam } from "@/lib/admin-data";
import { getRoster } from "@/lib/data";
import { all } from "@/lib/db";
import { displayName } from "@/lib/format";
import type { Person } from "@/lib/types";
import { ActionButton, ActionForm } from "../_components/action-form";
import { AdminPageHeader, Checkbox, Grid, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { MediaField } from "../_components/media-field";
import { SeasonPicker } from "../_components/season-picker";
import { addExistingPerson, addNewPerson, removeRosterEntry, updateRosterEntry } from "./actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Team roster" };

export default async function AdminRosterPage(props: PageProps<"/admin/roster">) {
  await requireAdminPage();
  const { season } = await props.searchParams;
  const { year, years } = await resolveSeasonParam(season);

  if (!year) {
    return (
      <>
        <AdminPageHeader title="Team roster" />
        <Panel title="No seasons yet">
          <Link href="/admin/seasons/new" className="font-semibold text-hornet">
            Create a season first
          </Link>
        </Panel>
      </>
    );
  }

  const [roster, others, library] = await Promise.all([
    getRoster(year),
    all<Person>(
      `SELECT p.*, NULL AS photo_key FROM people p
       WHERE p.id NOT IN (SELECT person_id FROM roster_entries WHERE season_year = ?)
       ORDER BY p.kind, p.first_name, p.last_name`,
      year,
    ),
    getMediaOptions(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Team roster"
        description="Students appear on the site as first name and last initial. Their photos only show if 'Show photo' is on."
      />
      <SeasonPicker basePath="/admin/roster" years={years} current={year} />

      <Panel title={`${year} roster`} description={`${roster.length} people`}>
        {roster.length === 0 ? (
          <p className="text-sm text-dust">Nobody on this season yet. Add people below.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {roster.map((m) => (
              <li key={m.entry_id} className="flex flex-col gap-3 py-3 xl:flex-row xl:items-center">
                <div className="flex min-w-56 items-baseline gap-2">
                  <Link href={`/admin/people/${m.id}`} className="font-semibold hover:text-hornet">
                    {m.first_name} {m.last_name}
                  </Link>
                  <span className={`font-label text-[11px] uppercase ${m.kind === "mentor" ? "text-mentor" : "text-ash"}`}>{m.kind}</span>
                </div>
                <ActionForm action={updateRosterEntry.bind(null, m.entry_id)} className="grow" submitLabel="Save" submitVariant="secondary">
                  <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_90px_auto]">
                    <TextField label="Role" name="role" defaultValue={m.role} />
                    <TextField label="Subteam" name="subteam" defaultValue={m.subteam} />
                    <TextField label="Order" name="sort_order" type="number" defaultValue={m.sort_order} />
                    <div className="pb-2.5">
                      <Checkbox label="Leadership" name="is_leadership" defaultChecked={m.is_leadership === 1} />
                    </div>
                  </div>
                </ActionForm>
                <ActionButton action={removeRosterEntry.bind(null, m.entry_id)} variant="danger" confirm={`Remove ${displayName(m)} from ${year}?`}>
                  Remove
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Add someone new">
          <ActionForm action={addNewPerson.bind(null, year)} submitLabel="Add to roster" resetOnSuccess>
            <Grid>
              <TextField label="First name" name="first_name" required />
              <TextField label="Last name" name="last_name" hint="Students show as the initial only." />
              <SelectField
                label="Type"
                name="kind"
                defaultValue="student"
                options={[
                  { value: "student", label: "Student" },
                  { value: "mentor", label: "Mentor / teacher sponsor" },
                ]}
              />
              <TextField label="Graduation year" name="graduation_year" type="number" placeholder={String(year + 1)} hint="Used to skip graduates when starting a new season." />
              <TextField label="Role" name="role" placeholder="Programming lead" />
              <TextField label="Subteam" name="subteam" placeholder="Programming" />
            </Grid>
            <TextArea label="Short bio" name="bio" rows={2} />
            <MediaField name="photo_media_id" label="Photo" current={null} library={library} />
            <Checkbox label="Show photo on the public site" name="show_photo" hint="Leave off for students unless you have permission." />
            <Checkbox label="Leadership" name="is_leadership" />
          </ActionForm>
        </Panel>
        {others.length > 0 && (
          <Panel title="Add someone from another season">
            <ActionForm action={addExistingPerson.bind(null, year)} submitLabel="Add to roster" resetOnSuccess>
              <SelectField
                label="Person"
                name="person_id"
                options={[
                  { value: "", label: "Choose…" },
                  ...others.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name} (${p.kind})` })),
                ]}
              />
              <Grid>
                <TextField label="Role" name="role" placeholder="Member" />
                <TextField label="Subteam" name="subteam" />
              </Grid>
              <Checkbox label="Leadership" name="is_leadership" />
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
