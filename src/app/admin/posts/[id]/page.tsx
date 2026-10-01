import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { directUploadsEnabled, getSeasonYears } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { all, first } from "@/lib/db";
import { seasonLabel } from "@/lib/format";
import { ActionButton } from "../../_components/action-form";
import { BulkUploader } from "../../_components/bulk-uploader";
import { AdminPageHeader, Checkbox, DeletePanel, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { PhotosEditor, type EditorPhoto } from "../../_components/photos-editor";
import { EditForm } from "../../_components/unsaved";
import { deletePost, ensurePostAlbum, moveToImpact, updatePost } from "../actions";
import { MarkdownEditor } from "../markdown-editor";

export const metadata: Metadata = { title: "Edit post" };

type PostRow = {
  id: number;
  slug: string;
  title: string;
  category: "news" | "outreach";
  excerpt: string;
  body: string;
  album_id: number | null;
  season_year: number | null;
  published: number;
  published_at: string | null;
};

export default async function EditPostPage(props: PageProps<"/admin/posts/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const { created } = await props.searchParams;
  const post = Number.isInteger(id)
    ? await first<PostRow>("SELECT id, slug, title, category, excerpt, body, album_id, season_year, published, published_at FROM posts WHERE id = ?", id)
    : null;
  if (!post) notFound();
  const [years, direct, album, photos] = await Promise.all([
    getSeasonYears(),
    directUploadsEnabled(),
    post.album_id ? first<{ id: number; title: string; cover_media_id: number | null }>("SELECT id, title, cover_media_id FROM albums WHERE id = ?", post.album_id) : null,
    post.album_id
      ? all<EditorPhoto>(
          `SELECT ap.media_id, m.r2_key, m.alt, m.filename, ap.caption FROM album_photos ap JOIN media m ON m.id = ap.media_id
           WHERE ap.album_id = ? ORDER BY ap.sort_order, m.created_at`,
          post.album_id,
        )
      : [],
  ]);
  const live = post.published === 1 && post.category === "outreach";

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/posts">Outreach posts /</Link>}
        title={post.title}
        description={
          created ? "Draft started. Write it, add photos, then tick Published." : live ? "Live on the Impact page." : post.category === "news" ? "An old News post: not on the site." : "Draft: not on the site yet."
        }
        actions={
          live ? (
            <Link href={`/impact/${post.slug}`} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
              View on site
            </Link>
          ) : undefined
        }
      />

      {post.category === "news" && (
        <div className="flex flex-col gap-3 rounded-md border border-line-strong bg-raise p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>This was written for the News section, which isn&apos;t on the site anymore. Move it to make it an outreach post on the Impact page.</span>
          <ActionButton action={moveToImpact.bind(null, id)} variant="primary">
            Move to Impact
          </ActionButton>
        </div>
      )}

      <EditForm action={updatePost.bind(null, id)}>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Panel>
            <TextField label="Title" name="title" defaultValue={post.title} required />
            <TextArea label="Summary" name="excerpt" rows={2} defaultValue={post.excerpt} hint="One or two sentences shown on cards and in search results." />
            <MarkdownEditor name="body" defaultValue={post.body} />
          </Panel>
          <Panel title="Publishing">
            <Checkbox label="Published" name="published" defaultChecked={post.published === 1} hint="Drafts are only visible here." />
            <TextField label="Date" name="published_at" type="date" defaultValue={post.published_at?.slice(0, 10)} hint="Leave blank to use today when publishing." />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={post.season_year ?? ""}
              options={[{ value: "", label: "Not tied to a season" }, ...years.map((y) => ({ value: y, label: `${seasonLabel(y)} season` }))]}
              hint="Also lists the post on that season's page."
            />
            <TextField label="URL slug" name="slug" defaultValue={post.slug} hint="Made from the title if blank." />
          </Panel>
        </div>
      </EditForm>

      <Panel
        title="Photos"
        description={
          <>
            The main photo is the post&apos;s cover; all of them show at the end of the post, in this order. Click a photo to describe it, make it the main photo or remove it.
            {album && (
              <>
                {" "}They&apos;re the album{" "}
                <Link href={`/admin/gallery/${album.id}`} className="font-semibold text-hornet hover:text-hornet-hover">
                  {album.title}
                </Link>
                , shown in the Gallery while the post is published.
              </>
            )}
          </>
        }
      >
        <BulkUploader albumId={album?.id} ensureAlbum={album ? undefined : ensurePostAlbum.bind(null, id)} label="Add photos to this post" direct={direct} />
        {album && photos.length > 0 && <PhotosEditor albumId={album.id} coverId={album.cover_media_id} photos={photos} coverLabel="Make main photo" />}
      </Panel>

      <DeletePanel title="Delete this post" description="Removes the post from the site. Its photos stay in the Gallery.">
        <ActionButton action={deletePost.bind(null, id)} variant="danger" confirm="Delete this post? This can't be undone. Its photos stay in the Gallery.">
          Delete post
        </ActionButton>
      </DeletePanel>
    </>
  );
}
