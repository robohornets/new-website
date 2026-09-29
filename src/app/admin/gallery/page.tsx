import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { getSeasonYears } from "@/lib/admin-data";
import { ALBUM_COLUMNS } from "@/lib/data";
import { all } from "@/lib/db";
import type { Album } from "@/lib/types";
import { ActionForm } from "../_components/action-form";
import { AdminPageHeader, Checkbox, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { createAlbum } from "./actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Gallery" };

export default async function AdminGalleryPage() {
  await requireAdminPage();
  const [albums, years] = await Promise.all([
    all<Album>(
      `SELECT ${ALBUM_COLUMNS} FROM albums a ORDER BY a.season_year IS NULL, a.season_year DESC, a.created_at DESC`,
    ),
    getSeasonYears(),
  ]);

  return (
    <>
      <AdminPageHeader title="Gallery" description="Albums of photos, usually one per event. Photos are stored in the R2 bucket." />
      <Panel title="New album">
        <ActionForm action={createAlbum} submitLabel="Create album">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            <TextField label="Title" name="title" required placeholder="Green Country Regional" />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={years[0] ?? ""}
              options={[{ value: "", label: "No season" }, ...years.map((y) => ({ value: y, label: String(y) }))]}
            />
            <TextField label="URL slug" name="slug" hint="Optional" />
          </div>
          <TextArea label="Description" name="description" rows={2} />
          <Checkbox label="Visible on the site" name="published" defaultChecked />
        </ActionForm>
      </Panel>
      <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {albums.length === 0 && <p className="text-dust">No albums yet. Create one to start uploading.</p>}
        {albums.map((a) => (
          <Link key={a.id} href={`/admin/gallery/${a.id}`} className="group flex flex-col overflow-hidden rounded-md border border-line bg-panel hover:border-edge">
            <MediaImage mediaKey={a.cover_key} alt="" className="h-40 w-full" placeholder="No photos yet" maxWidth={640} />
            <div className="flex flex-col gap-1 p-4">
              <span className="font-semibold group-hover:text-hornet">{a.title}</span>
              <span className="font-label text-xs text-dust">
                {a.season_year ?? "No season"} · {a.photo_count} photos {a.published ? "" : "· HIDDEN"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
