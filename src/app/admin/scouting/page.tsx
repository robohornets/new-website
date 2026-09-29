import type { Metadata } from "next";
import Link from "next/link";
import { resolveSeasonParam } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { all, first, parseJson } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { cleanForm, EMPTY_FORM, STARTER_FORM } from "@/lib/scouting";
import { cachedNicknames, getScoutingForm } from "@/lib/scouting-data";
import { CopyLink } from "../_components/copy-link";
import { AdminPageHeader, Checkbox, Panel } from "../_components/fields";
import { SeasonPicker } from "../_components/season-picker";
import { EditForm } from "../_components/unsaved";
import { saveSettings } from "../settings/actions";
import { saveScoutingForm } from "./actions";
import { FormBuilder } from "./form-builder";

export const metadata: Metadata = { title: "Scouting" };

export default async function AdminScoutingPage(props: PageProps<"/admin/scouting">) {
  await requireAdminPage();
  const { season } = await props.searchParams;
  const { year, years } = await resolveSeasonParam(season);
  if (!year) {
    return (
      <>
        <AdminPageHeader title="Scouting" />
        <Panel title="No seasons yet">
          <Link href="/admin/seasons/new" className="font-semibold text-hornet">
            Create a season first
          </Link>
        </Panel>
      </>
    );
  }

  const [settings, form, previousRow, teams] = await Promise.all([
    getSettings(),
    getScoutingForm(year),
    first<{ season_year: number; fields: string }>(
      "SELECT season_year, fields FROM scouting_forms WHERE season_year < ? ORDER BY season_year DESC LIMIT 1",
      year,
    ),
    all<{ team_number: number; robot: number; reports: number; deleted: number; last: string }>(
      `SELECT team_number,
              SUM(kind = 'robot' AND deleted_at IS NULL) AS robot,
              SUM(kind = 'report' AND deleted_at IS NULL) AS reports,
              SUM(deleted_at IS NOT NULL) AS deleted,
              MAX(updated_at) AS last
       FROM scouting_entries WHERE season_year = ? GROUP BY team_number ORDER BY team_number`,
      year,
    ),
  ]);
  const previous = previousRow ? { year: previousRow.season_year, form: cleanForm(parseJson(previousRow.fields, EMPTY_FORM)) } : null;
  const names = await cachedNicknames(teams.map((t) => t.team_number));
  const open = settings.scouting.open;
  const questions = [...form.robot, ...form.match].filter((f) => f.type !== "section").length;

  return (
    <>
      <AdminPageHeader
        title="Scouting"
        description="A public notebook for scouting other teams at competitions. Anyone with the link can add, edit or delete; every change is kept here so you can undo it."
      />
      <SeasonPicker basePath="/admin/scouting" years={years} current={year} />

      <Panel title="Scouting page">
        <EditForm action={saveSettings.bind(null, "scouting")}>
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox
              label="Open /scouting"
              name="open"
              defaultChecked={open}
              hint="Turn this on after kickoff, once the form for this year's game is ready. It uses the current season's form."
            />
            <span className={`rounded px-2.5 py-1 font-label text-xs font-bold tracking-wider ${open ? "bg-rust text-white" : "bg-raise text-dust"}`}>
              {open ? "OPEN" : "CLOSED"}
            </span>
          </div>
        </EditForm>
        <CopyLink path="/scouting" />
        {open && questions === 0 && (
          <p className="text-sm text-hornet">Scouting is open, but the {year} form has no questions yet. Build it below.</p>
        )}
      </Panel>

      <Panel
        title={`${year} form`}
        description="Each season gets its own form, since the game changes. Robot questions are one shared sheet per team; match reports can be added as often as you like."
      >
        <EditForm action={saveScoutingForm.bind(null, year)}>
          <FormBuilder saved={form} starter={STARTER_FORM} previous={previous} />
        </EditForm>
      </Panel>

      <Panel
        title={`${year} results`}
        description={teams.length ? `${teams.length} teams scouted.` : "Nothing scouted yet this season."}
        actions={
          teams.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <a href={`/admin/api/scouting-export?season=${year}&part=robot`} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
                Robots CSV
              </a>
              <a href={`/admin/api/scouting-export?season=${year}&part=match`} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
                Match reports CSV
              </a>
            </div>
          ) : undefined
        }
      >
        {teams.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line font-label text-[11px] tracking-wider text-ash uppercase">
                <tr>
                  <th className="py-2 pr-4 font-normal">Team</th>
                  <th className="py-2 pr-4 font-normal">Robot sheet</th>
                  <th className="py-2 pr-4 font-normal">Reports</th>
                  <th className="py-2 pr-4 font-normal">Last change</th>
                  <th className="py-2 font-normal">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.team_number} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="font-label font-bold">{t.team_number}</span>
                      {names.get(t.team_number) && <span className="ml-2 text-sand">{names.get(t.team_number)}</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-dust">{t.robot ? "Yes" : "—"}</td>
                    <td className="py-2.5 pr-4 font-label">
                      {t.reports}
                      {t.deleted > 0 && <span className="ml-2 font-sans text-xs text-ash">({t.deleted} deleted)</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-dust">{formatDateTime(t.last)}</td>
                    <td className="py-2.5 text-right">
                      <Link href={`/admin/scouting/${t.team_number}?season=${year}`} className="font-semibold text-hornet hover:text-hornet-hover">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
