import type { Metadata } from "next";
import { ImpactCard } from "@/components/impact-card";
import { OutreachTotalsStrip } from "@/components/outreach-totals";
import { Container, EmptyState, PageHeader } from "@/components/page-header";
import { getPublicOutreachEvents, getPublicOutreachTotals } from "@/lib/outreach";

export const metadata: Metadata = {
  title: "Impact",
  description: "How the RoboHornets share FIRST and STEM with Booker T. Washington and Tulsa.",
};

export default async function ImpactPage() {
  const [totals, events] = await Promise.all([getPublicOutreachTotals(), getPublicOutreachEvents()]);
  const upcoming = events.filter((e) => e.upcoming === 1).reverse();
  const past = events.filter((e) => e.upcoming !== 1);
  const grid = "grid gap-4 md:grid-cols-2 xl:grid-cols-3";

  return (
    <>
      <PageHeader
        label="Outreach & community"
        title="Impact"
        intro={<p>Demos, recruiting, the Impact Award and every other way we share FIRST with Booker T. and Tulsa.</p>}
      />
      {totals && <OutreachTotalsStrip totals={totals} />}
      <Container className="flex flex-col gap-14 py-16 md:py-24">
        {upcoming.length > 0 && (
          <section className="flex flex-col gap-6">
            <h2 className="font-display text-4xl font-extrabold uppercase">Coming up</h2>
            <ul className={grid}>
              {upcoming.map((e) => (
                <li key={e.id}>
                  <ImpactCard event={e} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="flex flex-col gap-6">
          <h2 className="font-display text-4xl font-extrabold uppercase">What we&apos;ve done</h2>
          {past.length === 0 ? (
            <EmptyState>Our impact events will show up here.</EmptyState>
          ) : (
            <ul className={grid}>
              {past.map((e) => (
                <li key={e.id}>
                  <ImpactCard event={e} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </>
  );
}
