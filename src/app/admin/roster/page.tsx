import type { Metadata } from "next";
import Link from "next/link";
import { getMediaOptions, resolveSeasonParam } from "@/lib/admin-data";
import { getRoster, getSubteams } from "@/lib/data";
import { all } from "@/lib/db";
import type { Person } from "@/lib/types";
import { ActionForm, InlineActionButton } from "../_components/action-form";
import { AdminPageHeader, Checkbox, Grid, inputClass, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { MediaField } from "../_components/media-field";
import { SeasonPicker } from "../_components/season-picker";
import { EditForm } from "../_components/unsaved";
import { addExistingPerson, addNewPerson, createSubteam, deleteSubteam, saveSubteams } from "./actions";
import { RosterList } from "./roster-list";
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

  const [roster, others, library, subteams] = await Promise.all([
    getRoster(year),
    all<Person>(
      `SELECT p.*, NULL AS photo_key FROM people p
       WHERE p.id NOT IN (SELECT person_id FROM roster_entries WHERE season_year = ?)
       ORDER BY p.kind, p.first_name, p.last_name`,
      year,
    ),
    getMediaOptions(),
    getSubteams(),
  ]);
  const onSubteam = (id: number) => roster.filter((m) => m.subteam_id === id || m.extra_subteam_ids.includes(id)).length;
  const subteamOptions = [{ value: "", label: "None" }, ...subteams.map((t) => ({ value: t.id, label: t.private ? `${t.name} (private)` : t.name }))];

  return (
    <>
      <AdminPageHeader
        title="Team roster"
        description="Students appear on the site as first name and last initial. Their photos only show if 'Show photo' is on."
      />
      <SeasonPicker basePath="/admin/roster" years={years} current={year} />

      <Panel
        title="Subteams"
        description="The list you pick from on the roster and the join form. Private subteams (like Drive Team) can't be picked on the join form; only an admin can put someone on one."
      >
        {subteams.length > 0 && (
          <EditForm action={saveSubteams} className="gap-0">
            <input type="hidden" name="ids" value={subteams.map((t) => t.id).join(",")} />
            <div className="hidden grid-cols-[80px_1fr_120px_140px_auto] gap-3 pb-2 font-label text-[11px] tracking-wider text-ash uppercase md:grid">
              <span>Order</span>
              <span>Name</span>
              <span>Private</span>
              <span>{year} roster</span>
              <span className="sr-only">Delete</span>
            </div>
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {subteams.map((t) => (
                <li key={t.id} className="grid grid-cols-[72px_1fr] items-center gap-3 py-2 md:grid-cols-[80px_1fr_120px_140px_auto]">
                  <input
                    type="number"
                    name={`order_${t.id}`}
                    defaultValue={t.sort_order}
                    aria-label={`${t.name}: order`}
                    className={inputClass}
                  />
                  <input name={`name_${t.id}`} defaultValue={t.name} aria-label={`${t.name}: name`} className={inputClass} />
                  <label className="col-start-2 flex items-center gap-2 text-sm md:col-start-auto">
                    <input type="checkbox" name={`private_${t.id}`} defaultChecked={t.private === 1} className="size-4 accent-hornet" />
                    Private
                  </label>
                  <span className="col-start-2 text-sm text-dust md:col-start-auto">
                    {onSubteam(t.id) === 1 ? "1 person" : `${onSubteam(t.id)} people`}
                  </span>
                  <InlineActionButton
                    action={deleteSubteam.bind(null, t.id)}
                    confirm={`Delete ${t.name}? People on it stay on the roster with no subteam.`}
                    className="col-start-2 justify-self-start md:col-start-auto"
                  >
                    Delete
                  </InlineActionButton>
                </li>
              ))}
            </ul>
          </EditForm>
        )}
        <ActionForm action={createSubteam} submitLabel="Add subteam" submitVariant="secondary" resetOnSuccess className="mt-2">
          <div className="flex flex-wrap items-end gap-4">
            <TextField label="New subteam" name="name" placeholder="Pit Crew" className="min-w-60 grow md:grow-0" />
            <div className="pb-2.5">
              <Checkbox label="Private" name="private" />
            </div>
          </div>
        </ActionForm>
      </Panel>

      <Panel title={`${year} roster`}>
        {roster.length === 0 ? (
          <p className="text-sm text-dust">Nobody on this season yet. Add people below.</p>
        ) : (
          <RosterList members={roster} subteams={subteams} year={year} />
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
              <SelectField label="Subteam" name="subteam_id" defaultValue="" options={subteamOptions} />
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
                <SelectField label="Subteam" name="subteam_id" defaultValue="" options={subteamOptions} />
              </Grid>
              <Checkbox label="Leadership" name="is_leadership" />
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
