import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { all, first } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";
import { downloadUrl, isVideo, mediaUrl, originalUrl } from "@/lib/media";
import type { Media } from "@/lib/types";
import { ActionButton, ActionForm } from "../_components/action-form";
import { BulkUploader } from "../_components/bulk-uploader";
import { AdminPageHeader, TextField } from "../_components/fields";
import { deleteMedia, updateMediaAlt } from "./actions";

export const metadata: Metadata = { title: "Media library" };

const PAGE = 60;

export default async function AdminMediaPage(props: PageProps<"/admin/media">) {
  await requireAdminPage();
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1);
  const [items, total] = await Promise.all([
    all<Media>("SELECT * FROM media ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", PAGE, (page - 1) * PAGE),
    first<{ n: number; bytes: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM media"),
  ]);
  const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PAGE));

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description={`${total?.n ?? 0} files · ${formatBytes(total?.bytes ?? 0)} in the R2 bucket. Each file is stored once, exactly as uploaded; the site resizes photos on the fly.`}
        actions={
          <Link href="/admin/export" className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
            Download everything
          </Link>
        }
      />
      <BulkUploader />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {items.map((m) => {
          const original = originalUrl(m.r2_key) ?? "";
          const isImage = m.content_type.startsWith("image/");
          return (
            <li key={m.id} className="flex flex-col gap-3 rounded-md border border-line bg-panel p-3">
              <div className="hatch flex h-40 items-center justify-center overflow-hidden rounded">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(m.r2_key, 640) ?? original} alt={m.alt} loading="lazy" className="size-full object-cover" />
                ) : isVideo(m.r2_key) ? (
                  <video src={original} preload="metadata" muted className="size-full object-cover" />
                ) : (
                  <span className="font-label text-xs text-dust">{m.content_type}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-semibold" title={m.filename}>
                  {m.filename}
                </span>
                <span className="font-label text-[11px] text-ash">
                  {formatBytes(m.size_bytes)}
                  {m.width && m.height ? ` · ${m.width}×${m.height}` : ""} · {formatDate(m.created_at)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={downloadUrl(m.r2_key) ?? original} className="font-semibold text-hornet hover:text-hornet-hover">
                  Download original
                </a>
                <a href={original} target="_blank" rel="noopener noreferrer" className="text-dust hover:text-bone">
                  Open
                </a>
              </div>
              <ActionForm action={updateMediaAlt.bind(null, m.id)} submitLabel="Save" submitVariant="secondary">
                <TextField label="Alt text" name="alt" defaultValue={m.alt} />
              </ActionForm>
              <ActionButton action={deleteMedia.bind(null, m.id)} variant="danger" confirm={`Delete ${m.filename}? Anything using it will show no image.`}>
                Delete file
              </ActionButton>
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/admin/media?page=${page - 1}`} className="font-semibold text-hornet">
              ← Newer
            </Link>
          )}
          <span className="text-dust">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={`/admin/media?page=${page + 1}`} className="font-semibold text-hornet">
              Older →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
