import type { Metadata } from "next";
import Link from "next/link";
import { resolveSeasonParam } from "@/lib/admin-data";
import { getRoster, getSubteams } from "@/lib/data";
import { all } from "@/lib/db";
import type { Person } from "@/lib/types";
import { AdminPageHeader, Panel } from "../_components/fields";
import { SeasonPicker } from "../_components/season-picker";
import { RosterManager } from "./roster-manager";
import { requireAdminPage } from "@/lib/auth";
import { seasonLabel } from "@/lib/format";

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

  const [roster, others, subteams] = await Promise.all([
    getRoster(year),
    all<Person>(
      `SELECT p.*, NULL AS photo_key FROM people p
       WHERE p.id NOT IN (SELECT person_id FROM roster_entries WHERE season_year = ?)
       ORDER BY p.kind, p.first_name, p.last_name`,
      year,
    ),
    getSubteams(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Team roster"
        description="Students appear on the site as first name and last initial. Their photos only show if 'Show photo on the public site' is on."
      />
      <SeasonPicker basePath="/admin/roster" years={years} current={year} />
      <Panel title={`${seasonLabel(year)} roster`}>
        <RosterManager members={roster} subteams={subteams} others={others} year={year} />
      </Panel>
    </>
  );
}
