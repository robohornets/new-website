import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { all, first } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";
import { downloadUrl, isVideo, mediaUrl, originalUrl } from "@/lib/media";
import type { Media } from "@/lib/types";
import { ModalItem } from "../_components/items";
import { Pencil } from "@/components/icons";
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
          const preview = (big: boolean) =>
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(m.r2_key, big ? 960 : 640) ?? original} alt={m.alt} loading="lazy" className={big ? "max-h-full max-w-full object-contain" : "size-full object-cover"} />
            ) : isVideo(m.r2_key) ? (
              <video src={original} preload="metadata" muted controls={big} className={big ? "max-h-full max-w-full" : "size-full object-cover"} />
            ) : (
              <span className="font-label text-xs text-dust">{m.content_type}</span>
            );
          const meta = `${formatBytes(m.size_bytes)}${m.width && m.height ? ` · ${m.width}×${m.height}` : ""} · ${formatDate(m.created_at)}`;
          return (
            <li key={m.id} className="min-w-0">
              <ModalItem
                look="card"
                title={m.filename}
                description={meta}
                size="lg"
                action={updateMediaAlt.bind(null, m.id)}
                destroy={{ label: "Delete file", confirm: `Delete ${m.filename}? Anything using it will show no image.`, action: deleteMedia.bind(null, m.id) }}
                row={
                  <>
                    <span className="hatch flex h-40 items-center justify-center overflow-hidden rounded">{preview(false)}</span>
                    <span className="flex min-w-0 items-start justify-between gap-2">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold group-hover:text-hornet">{m.filename}</span>
                        <span className="font-label text-[11px] text-ash">{meta}</span>
                      </span>
                      <Pencil size={15} className="mt-0.5 shrink-0 text-dust group-hover:text-hornet" />
                    </span>
                  </>
                }
              >
                <div className="hatch flex h-[min(44vh,380px)] items-center justify-center overflow-hidden rounded">{preview(true)}</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <a href={downloadUrl(m.r2_key) ?? original} className="font-semibold text-hornet hover:text-hornet-hover">
                    Download original
                  </a>
                  <a href={original} target="_blank" rel="noopener noreferrer" className="text-dust hover:text-bone">
                    Open in a new tab
                  </a>
                </div>
                <TextField label="Alt text" name="alt" defaultValue={m.alt} hint="One short sentence describing it, for screen readers." />
              </ModalItem>
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
