import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoutingAnswers } from "@/components/scouting-answers";
import { resolveSeasonParam } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { all, parseJson } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { matchKeyLabel, type ScoutingData, type ScoutingField } from "@/lib/scouting";
import { cachedNicknames, getScoutingForm } from "@/lib/scouting-data";
import { ActionButton } from "../../_components/action-form";
import { AdminPageHeader, Panel } from "../../_components/fields";
import { deleteScoutingEntry, restoreScoutingEntry, restoreScoutingVersion } from "../actions";

export const metadata: Metadata = { title: "Scouting a team" };

type Entry = {
  id: number;
  kind: "robot" | "report";
  event_key: string | null;
  match_key: string | null;
  data: string;
  scouter: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
type Version = { id: number; entry_id: number; action: string; data: string; match_key: string | null; scouter: string; changed_by: string; changed_at: string };

export default async function AdminScoutingTeamPage(props: PageProps<"/admin/scouting/[team]">) {
  await requireAdminPage();
  const team = Number((await props.params).team);
  if (!Number.isInteger(team) || team < 1) notFound();
  const { season } = await props.searchParams;
  const { year } = await resolveSeasonParam(season);
  if (!year) notFound();

  const [form, entries, names] = await Promise.all([
    getScoutingForm(year),
    all<Entry>(
      `SELECT id, kind, event_key, match_key, data, scouter, deleted_at, created_at, updated_at FROM scouting_entries
       WHERE season_year = ? AND team_number = ? ORDER BY kind = 'robot' DESC, created_at DESC`,
      year,
      team,
    ),
    cachedNicknames([team]),
  ]);
  const versions = entries.length
    ? await all<Version>(
        `SELECT id, entry_id, action, data, match_key, scouter, changed_by, changed_at FROM scouting_history
         WHERE entry_id IN (${entries.map(() => "?").join(",")}) ORDER BY changed_at DESC, id DESC`,
        ...entries.map((e) => e.id),
      )
    : [];
  const live = entries.filter((e) => !e.deleted_at);
  const deleted = entries.filter((e) => e.deleted_at);
  const robot = live.find((e) => e.kind === "robot");
  const reports = live.filter((e) => e.kind === "report");

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href={`/admin/scouting?season=${year}`}>Scouting /</Link>}
        title={`Team ${team}`}
        description={
          <>
            {names.get(team) ? `${names.get(team)} · ` : ""}
            {year} season ·{" "}
            <a href={`/scouting#team=${team}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-hornet hover:text-hornet-hover">
              Open on /scouting
            </a>
          </>
        }
      />

      <Panel title="Robot sheet">
        {robot ? (
          <EntryCard entry={robot} fields={form.robot} versions={versions.filter((v) => v.entry_id === robot.id)} />
        ) : (
          <p className="text-sm text-dust">Nobody has filled in the robot questions yet.</p>
        )}
      </Panel>

      <Panel title={`Match reports (${reports.length})`}>
        {reports.length === 0 ? (
          <p className="text-sm text-dust">No reports yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id}>
                <EntryCard entry={r} fields={form.match} versions={versions.filter((v) => v.entry_id === r.id)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {deleted.length > 0 && (
        <Panel title={`Deleted (${deleted.length})`} description="Deleted from /scouting or here. Restore brings it back exactly as it was.">
          <ul className="flex flex-col gap-3">
            {deleted.map((d) => (
              <li key={d.id}>
                <EntryCard entry={d} fields={d.kind === "robot" ? form.robot : form.match} versions={versions.filter((v) => v.entry_id === d.id)} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function EntryCard({ entry: e, fields, versions }: { entry: Entry; fields: ScoutingField[]; versions: Version[] }) {
  const data = parseJson<ScoutingData>(e.data, {});
  return (
    <div className={`flex flex-col gap-4 rounded-md border p-4 ${e.deleted_at ? "border-dashed border-edge opacity-80" : "border-line bg-ink"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold">{e.kind === "robot" ? "Robot sheet" : matchKeyLabel(e.match_key)}</span>
        {e.event_key && <span className="font-label text-xs text-dust">{e.event_key}</span>}
        <span className="text-xs text-dust">
          Last saved by {e.scouter || "Anonymous"} · {formatDateTime(e.updated_at)}
        </span>
        <span className="ml-auto">
          {e.deleted_at ? (
            <ActionButton action={restoreScoutingEntry.bind(null, e.id)} variant="primary">
              Restore
            </ActionButton>
          ) : (
            <ActionButton action={deleteScoutingEntry.bind(null, e.id)} variant="danger" confirm="Delete this from /scouting? You can restore it afterwards.">
              Delete
            </ActionButton>
          )}
        </span>
      </div>
      <ScoutingAnswers fields={fields} data={data} />
      {versions.length > 0 && (
        <details className="group rounded-md border border-line">
          <summary className="flex h-10 list-none items-center gap-2 px-3 text-sm text-dust hover:text-bone">
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">
              ›
            </span>
            Earlier versions ({versions.length})
          </summary>
          <ol className="flex flex-col divide-y divide-line border-t border-line">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-col gap-3 p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-dust">
                  <span>
                    {v.action === "delete" ? "Before it was deleted" : v.action === "restore" ? "Before a restore" : "Before an edit"} by{" "}
                    <span className="text-sand">{v.changed_by || "Anonymous"}</span> · {formatDateTime(v.changed_at)}
                  </span>
                  <span className="ml-auto">
                    <ActionButton action={restoreScoutingVersion.bind(null, v.id)} confirm="Put this version back? What's there now is kept in the history too.">
                      Restore this version
                    </ActionButton>
                  </span>
                </div>
                <ScoutingAnswers fields={fields} data={parseJson<ScoutingData>(v.data, {})} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
