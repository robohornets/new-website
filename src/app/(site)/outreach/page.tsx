import type { Metadata } from "next";
import { PostIndex } from "@/components/post-index";
import { getPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Outreach",
  description: "How the RoboHornets share FIRST and STEM with Booker T. Washington and Tulsa.",
};

export default async function OutreachPage() {
  const posts = await getPosts({ category: "outreach" });
  return (
    <PostIndex
      category="outreach"
      posts={posts}
      intro="Demos, recruiting, the Impact Award and every other way we share FIRST with Booker T. and Tulsa."
    />
  );
}
