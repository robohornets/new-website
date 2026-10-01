import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { directUploadsEnabled, getSeasonYears } from "@/lib/admin-data";
import { all, first } from "@/lib/db";
import type { Album } from "@/lib/types";
import { ActionButton } from "../../_components/action-form";
import { EditForm } from "../../_components/unsaved";
import { BulkUploader } from "../../_components/bulk-uploader";
import { AdminPageHeader, Checkbox, DeletePanel, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { PhotosEditor } from "../../_components/photos-editor";
import { deleteAlbum, updateAlbum } from "../actions";
import { requireAdminPage } from "@/lib/auth";
import { seasonLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Edit album" };

export default async function AdminAlbumPage(props: PageProps<"/admin/gallery/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const album = Number.isInteger(id) ? await first<Album>("SELECT * FROM albums WHERE id = ?", id) : null;
  if (!album) notFound();
  const [photos, years, direct] = await Promise.all([
    all<{ media_id: number; r2_key: string; alt: string; filename: string; caption: string; sort_order: number }>(
      `SELECT ap.media_id, m.r2_key, m.content_type, m.alt, m.filename, ap.caption, ap.sort_order
       FROM album_photos ap JOIN media m ON m.id = ap.media_id WHERE ap.album_id = ? ORDER BY ap.sort_order, m.created_at`,
      id,
    ),
    getSeasonYears(),
    directUploadsEnabled(),
  ]);

  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/gallery">Gallery /</Link>}
        title={album.title}
        description={`${photos.length} photos${album.published ? "" : " · hidden from the site"}`}
        actions={
          album.published ? (
            <Link href={`/gallery/${album.slug}`} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
              View on site
            </Link>
          ) : undefined
        }
      />

      <Panel title="Album details">
        <EditForm action={updateAlbum.bind(null, id)}>
          <input type="hidden" name="cover_media_id" value={album.cover_media_id ?? ""} />
          <Grid cols={3}>
            <TextField label="Title" name="title" defaultValue={album.title} required />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={album.season_year ?? ""}
              options={[{ value: "", label: "No season" }, ...years.map((y) => ({ value: y, label: seasonLabel(y) }))]}
            />
            <TextField label="URL slug" name="slug" defaultValue={album.slug} />
          </Grid>
          <TextArea label="Description" name="description" rows={2} defaultValue={album.description} />
          <Checkbox label="Visible on the site" name="published" defaultChecked={album.published === 1} />
        </EditForm>
      </Panel>

      <Panel
        title="Photos"
        description="The site shows them in this order. Drag a photo by ⠿ (or use ◀ ▶) and save. Click a photo to add a description, make it the cover or remove it."
      >
        <BulkUploader albumId={id} label="Add photos and videos to this album" direct={direct} />
        {photos.length > 0 && <PhotosEditor albumId={id} coverId={album.cover_media_id} photos={photos} />}
      </Panel>

      <DeletePanel title="Delete this album" description="Removes the album from the Gallery. The photos stay in the Media library.">
        <ActionButton action={deleteAlbum.bind(null, id)} variant="danger" confirm="Delete this album? The photos stay in the media library.">
          Delete album
        </ActionButton>
      </DeletePanel>
    </>
  );
}
