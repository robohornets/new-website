import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { External, FileIcon, LinkIcon } from "@/components/icons";
import { Container } from "@/components/page-header";
import { SeasonRail, SeasonSubheader, SeasonTabs } from "@/components/season-tabs";
import { getSeason, getSeasons } from "@/lib/data";
import { getSeasonResources, getSeasonTabs, type ResourceItem } from "@/lib/season-extras";

const yearOf = (raw: string) => (/^\d{4}$/.test(raw) ? Number(raw) : null);

export async function generateMetadata(props: PageProps<"/seasons/[year]/resources">): Promise<Metadata> {
  const year = yearOf((await props.params).year);
  return { title: year ? `${year} resources` : "Resources", description: `Team 1209's ${year ?? ""} robot code, CAD, engineering notebook and more, free for any team to use.` };
}

function ResourceCard({ item }: { item: ResourceItem }) {
  const internal = item.href.startsWith("/") && !item.href.startsWith("/media/");
  const icon = item.kind === "PDF" || item.kind === "Image" || item.kind === "Video" || item.kind === "File" ? <FileIcon size={20} /> : <LinkIcon size={20} />;
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-raise text-hornet">{icon}</span>
      <span className="flex min-w-0 grow flex-col gap-1">
        <span className="flex items-center gap-2 font-semibold group-hover:text-hornet">
          {item.title}
          {item.external && <External size={14} className="shrink-0 text-dust" />}
        </span>
        {item.description && <span className="text-sm leading-relaxed text-sand">{item.description}</span>}
        <span className="font-label text-[11px] tracking-wider text-dust uppercase">{item.kind}</span>
      </span>
    </>
  );
  const cls = "group flex h-full gap-4 rounded-md border border-line bg-panel p-4 hover:border-edge md:p-5";
  return (
    <li>
      {internal ? (
        <Link href={item.href} className={cls}>
          {body}
        </Link>
      ) : (
        <a href={item.href} {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={cls}>
          {body}
        </a>
      )}
    </li>
  );
}

export default async function SeasonResourcesPage(props: PageProps<"/seasons/[year]/resources">) {
  const year = yearOf((await props.params).year);
  const season = year ? await getSeason(year) : null;
  if (!season) notFound();
  const [seasons, tabs, resources] = await Promise.all([getSeasons(), getSeasonTabs(season.year), getSeasonResources(season.year)]);
  if (!tabs.resources) notFound();

  return (
    <>
      <SeasonRail years={seasons.map((s) => s.year)} current={season.year} />
      <SeasonTabs year={season.year} active="resources" tabs={tabs} />
      <SeasonSubheader
        year={season.year}
        game={season.game_name}
        title="Resources"
        intro={<p>Everything we made this season that other teams can learn from: code, CAD, our engineering notebook and more. Use anything you find useful.</p>}
      />
      <Container className="flex flex-col gap-12 pb-20">
        {resources.season.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-3xl font-extrabold uppercase">{season.year} season</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {resources.season.map((r) => (
                <ResourceCard key={r.key} item={r} />
              ))}
            </ul>
          </section>
        )}
        {resources.team.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-3xl font-extrabold uppercase">Team documents</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {resources.team.map((r) => (
                <ResourceCard key={r.key} item={r} />
              ))}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
