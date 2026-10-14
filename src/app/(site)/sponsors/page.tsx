import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { SponsorLevels } from "@/components/sponsor-levels";
import { SponsorWall } from "@/components/sponsor-wall";
import { getLatestSponsors, getSettings, getSponsorLevels } from "@/lib/data";
import { seasonLabel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Sponsors",
  description: "The companies and organizations that make the RoboHornets possible, and the sponsorship levels for supporting the team.",
};

export default async function SponsorsPage() {
  const [{ year, sponsors }, levels, settings] = await Promise.all([getLatestSponsors(), getSponsorLevels(), getSettings()]);
  const inKind = settings.sponsor_in_kind;

  return (
    <>
      <PageHeader
        label={year ? `${seasonLabel(year)} season` : "Sponsors"}
        title="Our sponsors"
        intro={<p>Robots are expensive. These partners cover parts, tools, event fees and travel, and give our students a place to build.</p>}
      />
      <Container className="py-16 md:py-24">
        <SponsorWall sponsors={sponsors} />
      </Container>
      {levels.length > 0 && (
        <section id="levels" className="border-t border-line bg-panel">
          <Container className="flex flex-col gap-11 py-16 md:py-24">
            <SectionHeading
              label="Sponsorship levels"
              title="Compare the levels"
              aside={
                <p className="max-w-md text-[17px] leading-relaxed text-sand">
                  Every level pays for a different part of our season. Mentoring time and workspace count too.
                </p>
              }
            />
            <SponsorLevels levels={levels} />
          </Container>
        </section>
      )}
      <section id="support" className="border-t border-line">
        <Container className="grid items-start gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-4">
            <span className="eyebrow eyebrow-bar text-bone">Support the team</span>
            <h2 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">Put your name on the robot</h2>
            <p className="mt-2 max-w-xl text-lg leading-relaxed text-sand">
              You don&apos;t have to make a monetary donation to support or be recognized by our team. Tell us what you have in mind and
              we&apos;ll find the level that fits.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact?topic=sponsorship"
                className="flex h-13 items-center justify-center rounded-md bg-hornet px-6 font-bold text-ink hover:bg-hornet-hover"
              >
                Talk to us about sponsoring
              </Link>
              {settings.donate_url && (
                <a
                  href={settings.donate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-13 items-center justify-center rounded-md border-[1.5px] border-edge px-6 font-semibold text-bone hover:border-bone"
                >
                  Donate
                </a>
              )}
            </div>
          </div>
          {inKind.length > 0 && (
            <div className="flex flex-col gap-5 rounded-lg border border-line bg-panel p-6 md:p-8">
              <h3 className="eyebrow text-hornet">Gifts that aren&apos;t money</h3>
              <ul className="flex flex-col gap-3.5 text-[17px] leading-snug">
                {inKind.map((item, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span aria-hidden="true" className="mt-2 size-2 shrink-0 bg-hornet" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
