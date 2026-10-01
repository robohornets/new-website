import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/page-header";
import { ScoutingBrowser } from "@/components/scouting-browser";
import { SeasonRail, SeasonSubheader, SeasonTabs } from "@/components/season-tabs";
import { getSeason, getSeasons } from "@/lib/data";
import { getPublicScouting, getSeasonTabs } from "@/lib/season-extras";
import { seasonLabel } from "@/lib/format";

const yearOf = (raw: string) => (/^\d{4}$/.test(raw) ? Number(raw) : null);

export async function generateMetadata(props: PageProps<"/seasons/[year]/scouting">): Promise<Metadata> {
  const year = yearOf((await props.params).year);
  return { title: year ? `${seasonLabel(year)} scouting` : "Scouting", description: `Team 1209's scouting notes on the teams at our ${seasonLabel(year)} events.` };
}

export default async function SeasonScoutingPage(props: PageProps<"/seasons/[year]/scouting">) {
  const year = yearOf((await props.params).year);
  const season = year ? await getSeason(year) : null;
  if (!season) notFound();
  const [seasons, tabs, data] = await Promise.all([getSeasons(), getSeasonTabs(season.year), getPublicScouting(season.year)]);
  // Not published for this season (or nothing scouted): there's no tab.
  if (!data) notFound();

  return (
    <>
      <SeasonRail years={seasons.map((s) => s.year)} current={season.year} />
      <SeasonTabs year={season.year} active="scouting" tabs={tabs} />
      <SeasonSubheader
        year={season.year}
        game={season.game_name}
        title="Scouting"
        intro={<p>What RoboHornets scouts noted about the teams at our {seasonLabel(season.year)} events: each robot&apos;s abilities, and how it played match by match. Open a team to see everything.</p>}
      />
      <Container className="pb-20">
        {data.teams.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-10 text-center text-dust">Nothing scouted this season yet.</p>
        ) : (
          <ScoutingBrowser data={data} />
        )}
      </Container>
    </>
  );
}
