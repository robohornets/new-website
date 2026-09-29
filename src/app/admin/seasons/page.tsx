import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@/components/icons";
import { all } from "@/lib/db";
import { SEASON_STATUS_LABEL, type SeasonStatus } from "@/lib/types";
import { AdminPageHeader } from "../_components/fields";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Seasons" };

export default async function AdminSeasonsPage() {
  await requireAdminPage();
  const seasons = await all<{
    year: number;
    game_name: string;
    status: SeasonStatus;
    is_current: number;
    robots: string | null;
    events: number;
    roster: number;
  }>(
    `SELECT s.year, s.game_name, s.status, s.is_current,
            (SELECT GROUP_CONCAT(name, ', ') FROM robots r WHERE r.season_year = s.year) AS robots,
            (SELECT COUNT(*) FROM events e WHERE e.season_year = s.year) AS events,
            (SELECT COUNT(*) FROM roster_entries re WHERE re.season_year = s.year) AS roster
     FROM seasons s ORDER BY s.year DESC`,
  );
  const nextYear = (seasons[0]?.year ?? new Date().getFullYear() - 1) + 1;

  return (
    <>
      <AdminPageHeader
        title="Seasons"
        description="Each FRC year has its own game, robots, events, roster, sponsors and photos. Start a new one after kickoff (or before, to get set up)."
        actions={
          <Link
            href={`/admin/seasons/new?year=${nextYear}`}
            className="flex h-11 items-center gap-2 rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-amber"
          >
            <Plus size={16} /> Start {nextYear} season
          </Link>
        }
      />
      <div className="overflow-x-auto rounded-md border border-line bg-panel">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line font-mono text-[11px] tracking-wider text-ash uppercase">
            <tr>
              <th className="px-5 py-3 font-normal">Year</th>
              <th className="px-5 py-3 font-normal">Game</th>
              <th className="px-5 py-3 font-normal">Status</th>
              <th className="px-5 py-3 font-normal">Robots</th>
              <th className="px-5 py-3 font-normal">Events</th>
              <th className="px-5 py-3 font-normal">Roster</th>
              <th className="px-5 py-3 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.year} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-3.5">
                  <span className="font-display text-2xl font-extrabold">{s.year}</span>
                  {s.is_current === 1 && (
                    <span className="ml-2 rounded bg-amber-bg px-1.5 py-0.5 font-mono text-[10px] text-amber">CURRENT</span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-semibold">{s.game_name || "—"}</td>
                <td className="px-5 py-3.5 text-dust">{SEASON_STATUS_LABEL[s.status]}</td>
                <td className="px-5 py-3.5 text-sand">{s.robots || "—"}</td>
                <td className="px-5 py-3.5 font-mono">{s.events}</td>
                <td className="px-5 py-3.5 font-mono">{s.roster}</td>
                <td className="px-5 py-3.5 text-right">
                  <Link href={`/admin/seasons/${s.year}`} className="font-semibold text-hornet hover:text-amber">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
