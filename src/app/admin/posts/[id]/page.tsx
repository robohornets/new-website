import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMediaOptions, getSeasonYears } from "@/lib/admin-data";
import { first } from "@/lib/db";
import type { Post } from "@/lib/types";
import { ActionButton } from "../../_components/action-form";
import { AdminPageHeader, Panel } from "../../_components/fields";
import { deletePost, updatePost } from "../actions";
import { PostForm } from "../post-form";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage(props: PageProps<"/admin/posts/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const { created } = await props.searchParams;
  const post = Number.isInteger(id) ? await first<Post>("SELECT * FROM posts WHERE id = ?", id) : null;
  if (!post) notFound();
  const [library, years] = await Promise.all([getMediaOptions(), getSeasonYears()]);

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/posts">News &amp; outreach /</Link>}
        title={post.title}
        description={created ? "Post created." : post.published ? "Live on the site." : "Draft: not visible on the site yet."}
        actions={
          post.published ? (
            <Link href={`/news/${post.slug}`} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
              View on site
            </Link>
          ) : undefined
        }
      />
      <PostForm post={post} action={updatePost.bind(null, id)} library={library} years={years} />
      <Panel title="Danger zone">
        <ActionButton action={deletePost.bind(null, id)} variant="danger" confirm="Delete this post? This can't be undone.">
          Delete post
        </ActionButton>
      </Panel>
    </>
  );
}
