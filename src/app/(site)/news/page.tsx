import type { Metadata } from "next";
import { PostIndex } from "@/components/post-index";
import { getPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "News",
  description: "Season updates, competition recaps and team news from the RoboHornets.",
};

export default async function NewsPage() {
  const posts = await getPosts({ category: "news" });
  return <PostIndex category="news" posts={posts} intro="Season updates, competition recaps and everything else happening on Team 1209." />;
}
