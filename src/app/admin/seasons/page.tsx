import type { Metadata } from "next";
import Link from "next/link";
import { ShowMore } from "@/components/show-more";
import { Plus } from "@/components/icons";
import { Badge, LinkRow, RowContent } from "../_components/items";
import { all } from "@/lib/db";
import { SEASON_STATUS_LABEL, type SeasonStatus } from "@/lib/types";
import { AdminPageHeader, Panel } from "../_components/fields";
import { HistoryImporter } from "../_components/history-importer";
import { requireAdminPage } from "@/lib/auth";
import { getEnv } from "@/lib/cf";
import { tbaConfigured } from "@/lib/tba/client";
import { seasonLabel } from "@/lib/format";

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
            className="flex h-11 items-center gap-2 rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-hornet-hover"
          >
            <Plus size={16} /> Start {seasonLabel(nextYear)} season
          </Link>
        }
      />
      <Panel
        title="Team history from The Blue Alliance"
        description="Brings in every season 1209 has competed in: events, rankings, awards and matches. Seasons that don't exist yet are created. Nothing you've edited is overwritten, so it's safe to run again."
      >
        {tbaConfigured(await getEnv()) ? (
          <HistoryImporter />
        ) : (
          <p className="text-sm text-dust">Connect The Blue Alliance first (add the TBA API key; see the README).</p>
        )}
      </Panel>
      <ShowMore
        noun="seasons"
        className="flex flex-col gap-2"
        items={seasons.map((s) => (
          <li key={s.year}>
            <LinkRow href={`/admin/seasons/${s.year}`}>
              <RowContent
                opens="page"
                media={<span className="block w-16 font-display text-2xl leading-none font-extrabold">{seasonLabel(s.year)}</span>}
                title={s.game_name || "No game name yet"}
                meta={[SEASON_STATUS_LABEL[s.status], s.robots || "No robot", `${s.events} events`, `${s.roster} on the roster`].join(" · ")}
                badges={s.is_current === 1 ? <Badge tone="accent">Current</Badge> : undefined}
              />
            </LinkRow>
          </li>
        ))}
      />
    </>
  );
}
