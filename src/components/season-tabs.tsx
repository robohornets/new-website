import Link from "next/link";
import { Container } from "./page-header";
import { SeasonSwitcher } from "./season-switcher";

/**
 * Overview | Scouting | Resources under the season rail. Each is its own
 * page, so a link can go straight to one (Resources for judges, Scouting for
 * other teams). Tabs with nothing in them aren't shown.
 */
export function SeasonTabs({ year, active, tabs }: { year: number; active: "overview" | "scouting" | "resources"; tabs: { scouting: boolean; resources: boolean } }) {
  const items = [
    { key: "overview", label: "Overview", href: `/seasons/${year}` },
    ...(tabs.scouting ? [{ key: "scouting", label: "Scouting", href: `/seasons/${year}/scouting` }] : []),
    ...(tabs.resources ? [{ key: "resources", label: "Resources", href: `/seasons/${year}/resources` }] : []),
  ];
  if (items.length === 1) return null;
  return (
    <nav aria-label={`${year} season`} className="border-b border-line">
      <Container className="flex gap-1 overflow-x-auto">
        {items.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? "page" : undefined}
            className={`-mb-px flex h-13 shrink-0 items-center border-b-2 px-4 text-[15px] font-semibold ${
              t.key === active ? "border-hornet text-bone" : "border-transparent text-dust hover:border-edge hover:text-bone"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </Container>
    </nav>
  );
}

/** The strip of season years at the top of every season page. */
export function SeasonRail({ years, current }: { years: number[]; current: number }) {
  return (
    <nav aria-label="Seasons" className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-4 md:px-8 xl:px-16">
        <SeasonSwitcher years={years} current={current} href="/seasons/{year}" label="Season" variant="rail" />
      </div>
    </nav>
  );
}

/** The compact title on the Scouting and Resources tabs. */
export function SeasonSubheader({ year, game, title, intro }: { year: number; game: string; title: string; intro: React.ReactNode }) {
  return (
    <Container className="flex flex-col gap-4 pt-10 pb-8 md:pt-14">
      <span className="eyebrow text-dust">
        {year} {game}
      </span>
      <h1 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">{title}</h1>
      <div className="max-w-2xl text-[17px] leading-relaxed text-sand">{intro}</div>
    </Container>
  );
}
