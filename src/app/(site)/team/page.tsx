import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, External } from "@/components/icons";
import { Container, EmptyState, PageHeader } from "@/components/page-header";
import { RosterGrid } from "@/components/roster-grid";
import { getCurrentSeason, getMediaFile, getRoster, getSeasons, getSettings } from "@/lib/data";
import { documentLink } from "@/lib/media";

export const metadata: Metadata = {
  title: "Team",
  description: "Meet the students and mentors of FRC Team 1209, the RoboHornets.",
};

export default async function TeamPage() {
  const [settings, season, seasons] = await Promise.all([getSettings(), getCurrentSeason(), getSeasons()]);
  const [roster, planFile] = await Promise.all([
    season ? getRoster(season.year) : [],
    getMediaFile(settings.strategic_plan.media_id),
  ]);
  const students = roster.filter((m) => m.kind === "student");
  const mentors = roster.filter((m) => m.kind === "mentor");
  const { about, build_steps, join, mission, values, strategic_plan } = settings;
  const plan = documentLink(planFile?.r2_key, strategic_plan.url);
  const notebooks = seasons.flatMap((s) => {
    const link = documentLink(s.notebook_key, s.notebook_url);
    return link ? [{ year: s.year, game: s.game_name, ...link }] : [];
  });

  return (
    <>
      <PageHeader label="About the team" title="We are 1209" intro={<p>{about.body}</p>} />

      {(mission || values.length > 0) && (
        <Container className="flex flex-col gap-12 py-16 md:py-24">
          {mission && (
            <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-16">
              <h2 className="eyebrow eyebrow-bar self-start text-bone">Our mission</h2>
              <p className="max-w-4xl text-2xl leading-snug font-medium text-bone md:text-[34px] md:leading-[1.3]">{mission}</p>
            </div>
          )}
          {values.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-16">
              <div className="flex flex-col gap-3 self-start">
                <h2 className="eyebrow eyebrow-bar text-bone">Our values</h2>
                <p className="text-sm text-dust">The <em>FIRST</em> Core Values guide everything we do.</p>
              </div>
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {values.map((v, i) => (
                  <li key={v.title} className="flex flex-col gap-2 rounded-md bg-raise p-6">
                    <span className="font-label text-2xl font-medium text-hornet">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="text-lg font-bold tracking-wider uppercase">{v.title}</h3>
                    {v.body && <p className="text-[15px] leading-relaxed text-sand">{v.body}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Container>
      )}

      {about.long && (
        <Container className="grid gap-10 border-t border-line py-16 md:py-24 lg:grid-cols-[1fr_1.2fr]">
          <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-7xl">{about.heading}</h2>
          <div className="flex flex-col gap-5 text-lg leading-relaxed text-sand">
            {about.long.split(/\n{2,}/).map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
          </div>
        </Container>
      )}

      {build_steps.length > 0 && (
        <section className="border-y border-line bg-panel">
          <Container className="flex flex-col gap-10 py-16 md:py-24">
            <div className="flex flex-col gap-4">
              <span className="eyebrow eyebrow-bar text-bone">A year on the team</span>
              <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-7xl">How a season works</h2>
            </div>
            <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
              {build_steps.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-4 rounded-md border border-line bg-ink p-6 md:p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[44px] leading-none font-extrabold text-hornet">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-label text-xs text-dust uppercase">{step.when}</span>
                  </div>
                  <h3 className="font-display text-[34px] leading-none font-bold uppercase">{step.title}</h3>
                  <p className="leading-relaxed text-sand">{step.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      )}

      {(plan || notebooks.length > 0) && (
        <Container className="grid gap-6 pt-16 md:pt-24 lg:grid-cols-2">
          {plan && (
            <section className="flex flex-col gap-5 rounded-md border border-line bg-panel p-7 md:p-10">
              <span className="eyebrow eyebrow-bar text-bone">Strategic Plan</span>
              <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase">Where we&apos;re headed</h2>
              {strategic_plan.summary && <p className="text-[17px] leading-relaxed text-sand">{strategic_plan.summary}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-4 pt-2">
                <a
                  href={plan.href}
                  {...(plan.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex h-13 items-center gap-2 rounded-md bg-hornet px-6 font-bold text-ink hover:bg-hornet-hover"
                >
                  Read the Strategic Plan {plan.external ? <External size={16} /> : <Download size={16} />}
                </a>
                {strategic_plan.updated && <span className="text-sm text-dust">Updated {strategic_plan.updated}</span>}
              </div>
            </section>
          )}
          {notebooks.length > 0 && (
            <section className="flex flex-col gap-5 rounded-md border border-line bg-panel p-7 md:p-10">
              <span className="eyebrow eyebrow-bar text-bone">Engineering notebooks</span>
              <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase">How we built it</h2>
              <p className="text-[17px] leading-relaxed text-sand">Every design decision, test and iteration from each season, written up by the team.</p>
              <ul className="mt-auto flex flex-col divide-y divide-line border-t border-line">
                {notebooks.map((n) => (
                  <li key={n.year}>
                    <a
                      href={n.href}
                      {...(n.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="group flex min-h-13 items-center gap-4 py-3"
                    >
                      <span className="font-label text-lg font-bold text-hornet">{n.year}</span>
                      <span className="grow font-semibold group-hover:text-hornet">{n.game || `${n.year} season`}</span>
                      <span className="flex items-center gap-1.5 text-sm text-dust group-hover:text-bone">
                        {n.external ? "Open" : "PDF"} {n.external ? <External size={14} /> : <Download size={14} />}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Container>
      )}

      <Container className="flex flex-col gap-10 py-16 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <span className="eyebrow eyebrow-bar text-bone">{season ? `${season.year} season` : "Roster"}</span>
            <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-7xl">The crew</h2>
          </div>
          {season && (
            <Link href={`/seasons/${season.year}`} className="flex items-center gap-2 font-semibold text-hornet hover:text-hornet-hover">
              {season.year} season details <ArrowRight size={16} />
            </Link>
          )}
        </div>
        {students.length > 0 ? <RosterGrid members={students} /> : <EmptyState>This season&apos;s roster is on its way.</EmptyState>}
        {mentors.length > 0 && (
          <div className="flex flex-col gap-6 pt-6">
            <h3 className="font-display text-4xl font-extrabold uppercase">Mentors &amp; teacher sponsors</h3>
            <RosterGrid members={mentors} />
          </div>
        )}
      </Container>

      <Container className="pb-16 md:pb-24">
        <div className="flex flex-col items-start gap-5 rounded-md bg-hornet p-7 text-ink md:flex-row md:items-center md:justify-between md:p-12">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-6xl">{join.heading}</h2>
            <p className="max-w-xl text-[17px] leading-relaxed">{join.body}</p>
          </div>
          <Link href="/contact?topic=joining" className="flex h-13 shrink-0 items-center rounded-md bg-ink px-6 font-bold text-bone hover:bg-raise">
            How to join
          </Link>
        </div>
      </Container>
    </>
  );
}
