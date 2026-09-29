import Link from "next/link";
import { PostCard } from "./cards";
import { Container, EmptyState, PageHeader } from "./page-header";
import type { Post, PostCategory } from "@/lib/types";

export function PostIndex({ category, posts, intro }: { category: PostCategory; posts: Post[]; intro: string }) {
  const tabs: { href: string; label: string; key: PostCategory }[] = [
    { href: "/news", label: "News", key: "news" },
    { href: "/outreach", label: "Outreach", key: "outreach" },
  ];
  return (
    <>
      <PageHeader label="From the hive" title={category === "news" ? "News" : "Outreach"} intro={<p>{intro}</p>}>
        <nav aria-label="Post categories" className="flex gap-2 pt-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={t.key === category ? "page" : undefined}
              className={`flex h-11 items-center rounded-full px-5 text-sm font-semibold ${
                t.key === category ? "bg-bone text-ink" : "border border-line-strong text-sand hover:border-bone hover:text-bone"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <Container className="py-16 md:py-24">
        {posts.length === 0 ? (
          <EmptyState>Nothing posted here yet.</EmptyState>
        ) : (
          <div className="grid gap-12 md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
