import type { Metadata } from "next";
import Link from "next/link";
import { getMediaOptions, getSeasonYears } from "@/lib/admin-data";
import { AdminPageHeader } from "../../_components/fields";
import { createPost } from "../actions";
import { PostForm } from "../post-form";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireAdminPage();
  const [library, years] = await Promise.all([getMediaOptions(), getSeasonYears()]);
  return (
    <>
      <AdminPageHeader breadcrumb={<Link href="/admin/posts">News &amp; outreach /</Link>} title="New post" />
      <PostForm action={createPost} library={library} years={years} />
    </>
  );
}
