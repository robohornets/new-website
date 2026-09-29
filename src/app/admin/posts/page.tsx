import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@/components/icons";
import { all } from "@/lib/db";
import { formatDate } from "@/lib/format";
import type { Post } from "@/lib/types";
import { AdminPageHeader } from "../_components/fields";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "News & outreach" };

export default async function AdminPostsPage() {
  await requireAdminPage();
  const posts = await all<Post>("SELECT * FROM posts ORDER BY published ASC, COALESCE(published_at, created_at) DESC");
  return (
    <>
      <AdminPageHeader
        title="News & outreach"
        description="Articles for the News and Outreach pages. Drafts stay hidden until you publish them."
        actions={
          <Link href="/admin/posts/new" className="flex h-11 items-center gap-2 rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-amber">
            <Plus size={16} /> New post
          </Link>
        }
      />
      <div className="overflow-x-auto rounded-md border border-line bg-panel">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line font-mono text-[11px] tracking-wider text-ash uppercase">
            <tr>
              <th className="px-5 py-3 font-normal">Title</th>
              <th className="px-5 py-3 font-normal">Section</th>
              <th className="px-5 py-3 font-normal">Season</th>
              <th className="px-5 py-3 font-normal">Date</th>
              <th className="px-5 py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-dust">
                  No posts yet.
                </td>
              </tr>
            )}
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-3.5">
                  <Link href={`/admin/posts/${p.id}`} className="font-semibold hover:text-hornet">
                    {p.title}
                  </Link>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-sand uppercase">{p.category}</td>
                <td className="px-5 py-3.5 font-mono">{p.season_year ?? "—"}</td>
                <td className="px-5 py-3.5 text-dust">{formatDate(p.published_at ?? p.created_at)}</td>
                <td className="px-5 py-3.5">
                  {p.published ? (
                    <span className="rounded bg-amber-bg px-2 py-0.5 font-mono text-[11px] text-amber">LIVE</span>
                  ) : (
                    <span className="rounded border border-line-strong px-2 py-0.5 font-mono text-[11px] text-dust">DRAFT</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
