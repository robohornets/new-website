import type { Metadata } from "next";
import { OutreachTotalsStrip } from "@/components/outreach-totals";
import { PostIndex } from "@/components/post-index";
import { getPosts } from "@/lib/data";
import { getPublicOutreachTotals } from "@/lib/outreach";

export const metadata: Metadata = {
  title: "Outreach",
  description: "How the RoboHornets share FIRST and STEM with Booker T. Washington and Tulsa.",
};

export default async function OutreachPage() {
  const [posts, totals] = await Promise.all([getPosts({ category: "outreach" }), getPublicOutreachTotals()]);
  return (
    <PostIndex
      category="outreach"
      banner={totals && <OutreachTotalsStrip totals={totals} />}
      posts={posts}
      intro="Demos, recruiting, the Impact Award and every other way we share FIRST with Booker T. and Tulsa."
    />
  );
}
