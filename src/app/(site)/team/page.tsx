import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { Container, EmptyState, PageHeader } from "@/components/page-header";
import { RosterGrid } from "@/components/roster-grid";
import { getCurrentSeason, getRoster, getSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Team",
  description: "Meet the students and mentors of FRC Team 1209, the RoboHornets.",
};

export default async function TeamPage() {
  const [settings, season] = await Promise.all([getSettings(), getCurrentSeason()]);
  const roster = season ? await getRoster(season.year) : [];
  const students = roster.filter((m) => m.kind === "student");
  const mentors = roster.filter((m) => m.kind === "mentor");
  const { about, build_steps, join } = settings;

  return (
    <>
      <PageHeader label="About the team" title="We are 1209" intro={<p>{about.body}</p>} />

      {about.long && (
        <Container className="grid gap-10 py-16 md:py-24 lg:grid-cols-[1fr_1.2fr]">
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
              <span className="eyebrow text-hornet">A year on the team</span>
              <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-7xl">How a season works</h2>
            </div>
            <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
              {build_steps.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-4 rounded-md border border-line bg-ink p-6 md:p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[44px] leading-none font-extrabold text-hornet">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-xs text-dust uppercase">{step.when}</span>
                  </div>
                  <h3 className="font-display text-[34px] leading-none font-bold uppercase">{step.title}</h3>
                  <p className="leading-relaxed text-sand">{step.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      )}

      <Container className="flex flex-col gap-10 py-16 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <span className="eyebrow text-hornet">{season ? `${season.year} season` : "Roster"}</span>
            <h2 className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-7xl">The crew</h2>
          </div>
          {season && (
            <Link href={`/seasons/${season.year}`} className="flex items-center gap-2 font-semibold text-hornet hover:text-amber">
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
