import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/page-header";
import { SponsorWall } from "@/components/sponsor-wall";
import { getLatestSponsors, getSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Sponsors",
  description: "The companies and organizations that make the RoboHornets possible.",
};

export default async function SponsorsPage() {
  const [{ year, sponsors }, settings] = await Promise.all([getLatestSponsors(), getSettings()]);

  return (
    <>
      <PageHeader
        label={year ? `${year} season` : "Sponsors"}
        title="Our sponsors"
        intro={<p>Robots are expensive. These partners cover parts, tools, event fees and travel, and give our students a place to build.</p>}
      />
      <Container className="py-16 md:py-24">
        <SponsorWall sponsors={sponsors} />
      </Container>
      <section id="support" className="border-t border-line bg-panel">
        <Container className="grid gap-10 py-16 md:py-24 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="eyebrow eyebrow-bar text-bone">Support the team</span>
            <h2 className="font-display text-5xl leading-[0.95] font-black uppercase md:text-7xl">Put your name on the robot</h2>
          </div>
          <div className="flex flex-col gap-6 text-lg leading-relaxed text-sand">
            <p>
              Sponsors are listed here and on the robot, shirts and pit banner for the season. Donations of money, materials, machining time or
              mentoring all help, and we are happy to talk about what fits your company.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
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
        </Container>
      </section>
    </>
  );
}
