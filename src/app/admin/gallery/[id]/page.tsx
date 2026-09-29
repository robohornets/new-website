import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeasonYears } from "@/lib/admin-data";
import { all, first } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import type { Album } from "@/lib/types";
import { ActionButton, ActionForm } from "../../_components/action-form";
import { BulkUploader } from "../../_components/bulk-uploader";
import { AdminPageHeader, Checkbox, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { deleteAlbum, removeAlbumPhoto, setAlbumCover, updateAlbum, updateAlbumPhoto } from "../actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit album" };

export default async function AdminAlbumPage(props: PageProps<"/admin/gallery/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const album = Number.isInteger(id) ? await first<Album>("SELECT * FROM albums WHERE id = ?", id) : null;
  if (!album) notFound();
  const [photos, years] = await Promise.all([
    all<{ media_id: number; r2_key: string; alt: string; filename: string; caption: string; sort_order: number }>(
      `SELECT ap.media_id, m.r2_key, m.alt, m.filename, ap.caption, ap.sort_order
       FROM album_photos ap JOIN media m ON m.id = ap.media_id WHERE ap.album_id = ? ORDER BY ap.sort_order, m.created_at`,
      id,
    ),
    getSeasonYears(),
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

      <BulkUploader albumId={id} label="Add photos to this album" />

      <Panel title="Photos" description="Alt text describes the photo for screen readers. Captions show under the photo.">
        {photos.length === 0 ? (
          <p className="text-sm text-dust">No photos yet. Upload some above.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {photos.map((p) => (
              <li key={p.media_id} className="flex flex-col gap-3 rounded-md border border-line bg-ink p-3">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(p.r2_key) ?? ""} alt={p.alt} loading="lazy" className="h-44 w-full rounded object-cover" />
                  {album.cover_media_id === p.media_id && (
                    <span className="absolute top-2 left-2 rounded bg-ink/90 px-2 py-0.5 font-mono text-[10px] text-amber">COVER</span>
                  )}
                </div>
                <ActionForm action={updateAlbumPhoto.bind(null, id, p.media_id)} submitLabel="Save" submitVariant="secondary">
                  <TextField label="Alt text" name="alt" defaultValue={p.alt} placeholder="Drive team celebrating in the pits" />
                  <TextField label="Caption" name="caption" defaultValue={p.caption} />
                  <TextField label="Order" name="sort_order" type="number" defaultValue={p.sort_order} />
                </ActionForm>
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {album.cover_media_id !== p.media_id && (
                    <ActionButton action={setAlbumCover.bind(null, id, p.media_id)}>Make cover</ActionButton>
                  )}
                  <ActionButton action={removeAlbumPhoto.bind(null, id, p.media_id)} variant="danger" confirm="Remove this photo from the album? It stays in the media library.">
                    Remove
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Album details">
        <ActionForm action={updateAlbum.bind(null, id)}>
          <input type="hidden" name="cover_media_id" value={album.cover_media_id ?? ""} />
          <Grid cols={3}>
            <TextField label="Title" name="title" defaultValue={album.title} required />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={album.season_year ?? ""}
              options={[{ value: "", label: "No season" }, ...years.map((y) => ({ value: y, label: String(y) }))]}
            />
            <TextField label="URL slug" name="slug" defaultValue={album.slug} />
          </Grid>
          <TextArea label="Description" name="description" rows={2} defaultValue={album.description} />
          <Checkbox label="Visible on the site" name="published" defaultChecked={album.published === 1} />
        </ActionForm>
      </Panel>

      <Panel title="Danger zone">
        <ActionButton action={deleteAlbum.bind(null, id)} variant="danger" confirm="Delete this album? The photos stay in the media library.">
          Delete album
        </ActionButton>
      </Panel>
    </>
  );
}
