import type { Metadata } from "next";
import Link from "next/link";
import { first } from "@/lib/db";
import { ActionForm } from "../../_components/action-form";
import { AdminPageHeader, Checkbox, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { createSeason } from "../actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Start a new season" };

export default async function NewSeasonPage(props: PageProps<"/admin/seasons/new">) {
  await requireAdminPage();
  const { year: yearParam } = await props.searchParams;
  const current = await first<{ year: number; students: number; mentors: number; sponsors: number }>(
    `SELECT s.year,
       (SELECT COUNT(*) FROM roster_entries e JOIN people p ON p.id = e.person_id WHERE e.season_year = s.year AND p.kind = 'student') AS students,
       (SELECT COUNT(*) FROM roster_entries e JOIN people p ON p.id = e.person_id WHERE e.season_year = s.year AND p.kind = 'mentor') AS mentors,
       (SELECT COUNT(*) FROM sponsor_seasons ss WHERE ss.season_year = s.year) AS sponsors
     FROM seasons s ORDER BY s.is_current DESC, s.year DESC LIMIT 1`,
  );
  const suggested = Number(Array.isArray(yearParam) ? yearParam[0] : yearParam) || (current ? current.year + 1 : new Date().getFullYear());

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/seasons">Seasons /</Link>}
        title="Start a new season"
        description="Creates the season and copies over whatever you choose. You can add the robot and competitions on the next screen."
      />
      <ActionForm action={createSeason} submitLabel="Create season">
        <Panel title="Season basics">
          <Grid>
            <TextField label="Season year" name="year" type="number" defaultValue={suggested} required hint="The FRC season year, e.g. 2027." />
            <TextField label="Game name" name="game_name" placeholder="Revealed at kickoff" hint="You can fill this in after kickoff." />
            <TextField label="Kickoff date" name="kickoff_date" type="date" />
            <TextField label="Game reveal video" name="reveal_video_url" type="url" placeholder="https://youtube.com/…" />
          </Grid>
          <SelectField
            label="Status"
            name="status"
            defaultValue="pre_kickoff"
            options={[
              { value: "pre_kickoff", label: "Pre-kickoff" },
              { value: "build", label: "Build season" },
              { value: "competition", label: "Competition season" },
              { value: "offseason", label: "Offseason" },
            ]}
            className="md:max-w-xs"
          />
          <TextArea label="Season summary" name="summary" rows={4} placeholder="What's the game about and what are we building? You can fill this in later." />
        </Panel>
        {current && (
          <Panel title={`Carry over from ${current.year}`} description="Seniors with a graduation year before the new season are left off automatically.">
            <Checkbox name="carry_students" defaultChecked label={`Returning students (${current.students} on the ${current.year} roster)`} />
            <Checkbox name="carry_mentors" defaultChecked label={`Mentors and teacher sponsors (${current.mentors})`} />
            <Checkbox name="carry_sponsors" defaultChecked label={`Sponsors and their tiers (${current.sponsors})`} hint="Edit or remove any that aren't renewing." />
          </Panel>
        )}
        <Panel>
          <Checkbox
            name="make_current"
            defaultChecked
            label="Make this the current season on the homepage right away"
            hint={current ? `${current.year} moves to the Seasons archive with everything kept exactly as it is.` : undefined}
          />
        </Panel>
      </ActionForm>
    </>
  );
}
