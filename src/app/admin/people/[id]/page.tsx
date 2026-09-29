import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMediaOptions } from "@/lib/admin-data";
import { all, first } from "@/lib/db";
import type { Person } from "@/lib/types";
import { ActionButton, ActionForm } from "../../_components/action-form";
import { AdminPageHeader, Checkbox, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { MediaField } from "../../_components/media-field";
import { deletePerson, updatePerson } from "../../roster/actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit person" };

export default async function PersonPage(props: PageProps<"/admin/people/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const person = Number.isInteger(id) ? await first<Person>("SELECT *, NULL AS photo_key FROM people WHERE id = ?", id) : null;
  if (!person) notFound();
  const [seasons, library] = await Promise.all([
    all<{ season_year: number; role: string }>("SELECT season_year, role FROM roster_entries WHERE person_id = ? ORDER BY season_year DESC", id),
    getMediaOptions(),
  ]);

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/roster">Team roster /</Link>}
        title={`${person.first_name} ${person.last_name}`}
        description={seasons.length ? `On the team: ${seasons.map((s) => `${s.season_year} (${s.role})`).join(", ")}` : "Not on any season roster."}
      />
      <Panel title="Details">
        <ActionForm action={updatePerson.bind(null, id)}>
          <Grid>
            <TextField label="First name" name="first_name" defaultValue={person.first_name} required />
            <TextField label="Last name" name="last_name" defaultValue={person.last_name} />
            <SelectField
              label="Type"
              name="kind"
              defaultValue={person.kind}
              options={[
                { value: "student", label: "Student" },
                { value: "mentor", label: "Mentor / teacher sponsor" },
              ]}
            />
            <TextField label="Graduation year" name="graduation_year" type="number" defaultValue={person.graduation_year} />
          </Grid>
          <TextArea label="Short bio" name="bio" rows={3} defaultValue={person.bio} />
          <MediaField name="photo_media_id" label="Photo" current={library.find((m) => m.id === person.photo_media_id) ?? null} library={library} />
          <Checkbox label="Show photo on the public site" name="show_photo" defaultChecked={person.show_photo === 1} />
        </ActionForm>
      </Panel>
      <Panel title="Danger zone">
        <ActionButton action={deletePerson.bind(null, id)} variant="danger" confirm="Delete this person from every season? This can't be undone.">
          Delete person
        </ActionButton>
      </Panel>
    </>
  );
}
