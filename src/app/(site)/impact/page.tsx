import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/cards";
import { MediaImage } from "@/components/media-image";
import { OutreachTotalsStrip } from "@/components/outreach-totals";
import { Container, EmptyState, PageHeader } from "@/components/page-header";
import { getPosts } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getPublicOutreachEvents, getPublicOutreachTotals, type PublicOutreachEvent } from "@/lib/outreach";

export const metadata: Metadata = {
  title: "Impact",
  description: "How the RoboHornets share FIRST and STEM with Booker T. Washington and Tulsa.",
};

function when(e: PublicOutreachEvent) {
  if (!e.start_date) return "Date to be announced";
  const start = formatDate(e.start_date, { month: "long", day: "numeric", year: "numeric" });
  if (!e.end_date || e.end_date.slice(0, 10) === e.start_date.slice(0, 10)) return start;
  return `${formatDate(e.start_date, { month: "long", day: "numeric" })} – ${formatDate(e.end_date, { month: "long", day: "numeric", year: "numeric" })}`;
}

export default async function ImpactPage() {
  const [totals, events, posts] = await Promise.all([getPublicOutreachTotals(), getPublicOutreachEvents(), getPosts()]);
  const upcoming = events.filter((e) => e.upcoming === 1).reverse();
  const past = events.filter((e) => e.upcoming !== 1);

  const card = (e: PublicOutreachEvent) => (
    <li key={e.id}>
      <Link
        href={`/seasons/${e.season_year}/events/${e.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-panel hover:border-edge"
      >
        {e.cover_key && <MediaImage mediaKey={e.cover_key} alt="" className="h-48 w-full" maxWidth={960} />}
        <div className="flex grow flex-col gap-2 p-5">
          <span className="font-label text-xs tracking-wider text-dust uppercase">{when(e)}</span>
          <h3 className="font-display text-2xl leading-tight font-bold uppercase group-hover:text-hornet">{e.name}</h3>
          {e.location && <span className="text-sm text-dust">{e.location}</span>}
          {e.recap && <p className="line-clamp-4 text-[15px] leading-relaxed whitespace-pre-line text-sand">{e.recap}</p>}
        </div>
      </Link>
    </li>
  );

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
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upcoming.map(card)}</ul>
          </section>
        )}
        {posts.length > 0 && (
          <section className="flex flex-col gap-8">
            <h2 className="font-display text-4xl font-extrabold uppercase">Stories</h2>
            <div className="grid gap-12 md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}
        <section className="flex flex-col gap-6">
          <h2 className="font-display text-4xl font-extrabold uppercase">What we&apos;ve done</h2>
          {past.length === 0 ? (
            <EmptyState>Our outreach events will show up here.</EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{past.map(card)}</ul>
          )}
        </section>
      </Container>
    </>
  );
}
