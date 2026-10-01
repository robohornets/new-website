import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { getSeasonYears } from "@/lib/admin-data";
import { ALBUM_COLUMNS } from "@/lib/data";
import { all } from "@/lib/db";
import type { Album } from "@/lib/types";
import { AddButton } from "../_components/items";
import { AdminPageHeader, Checkbox, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { SortableGrid } from "../_components/sortable";
import { createAlbum, saveAlbumOrder } from "./actions";
import { requireAdminPage } from "@/lib/auth";
import { seasonLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Gallery" };

export default async function AdminGalleryPage() {
  await requireAdminPage();
  const [albums, years] = await Promise.all([
    all<Album>(
      `SELECT ${ALBUM_COLUMNS} FROM albums a ORDER BY a.sort_order, a.created_at DESC`,
    ),
    getSeasonYears(),
  ]);

  return (
    <>
      <AdminPageHeader title="Gallery" description="Albums of photos, usually one per event. Photos are stored in the R2 bucket." />
      <Panel
        title="Albums"
        description="This is the order the Gallery shows them in (and each season's page). Drag an album by ⠿, or use ◀ ▶, then save. Click an album to add photos."
        actions={
          <AddButton label="New album" title="New album" description="Usually one per event. You'll add the photos next." action={createAlbum} submitLabel="Create album">
            <TextField label="Title" name="title" required placeholder="Green Country Regional" />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={years[0] ?? ""}
              options={[{ value: "", label: "No season" }, ...years.map((y) => ({ value: y, label: seasonLabel(y) }))]}
            />
            <TextArea label="Description" name="description" rows={2} />
            <TextField label="URL slug" name="slug" hint="Optional: made from the title if left blank." />
            <Checkbox label="Visible on the site" name="published" defaultChecked />
          </AddButton>
        }
      >
        {albums.length === 0 ? (
          <p className="text-dust">No albums yet. Create one to start uploading.</p>
        ) : (
          <SortableGrid
            action={saveAlbumOrder}
            newItems="start"
            className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            items={albums.map((a) => ({
              id: a.id,
              label: a.title,
              node: (
                <Link href={`/admin/gallery/${a.id}`} className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-ink hover:border-edge">
                  <MediaImage mediaKey={a.cover_key} alt="" className="h-40 w-full" placeholder="No photos yet" maxWidth={640} />
                  <div className="flex flex-col gap-1 p-4">
                    <span className="font-semibold group-hover:text-hornet">{a.title}</span>
                    <span className="font-label text-xs text-dust">
                      {a.season_year ? seasonLabel(a.season_year) : "No season"} · {a.photo_count} photos {a.published ? "" : "· HIDDEN"}
                    </span>
                  </div>
                </Link>
              ),
            }))}
          />
        )}
      </Panel>
    </>
  );
}
