import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "@/components/icons";
import { getSeasonYears } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { all } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";
import { downloadUrl, isVideo, mediaUrl, originalUrl } from "@/lib/media";
import { countMedia, searchMedia, type MediaFilters, type MediaKind, type MediaSort } from "@/lib/media-search";
import { getMediaUsage } from "@/lib/media-usage";
import { BulkUploader } from "../_components/bulk-uploader";
import { AdminPageHeader, TextField } from "../_components/fields";
import { Badge, ModalItem } from "../_components/items";
import type { FilterValue } from "../_components/media-filters";
import { deleteMedia, updateMediaAlt } from "./actions";
import { MediaPageFilters } from "./media-page-filters";

export const metadata: Metadata = { title: "Media library" };

const PAGE = 60;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminMediaPage(props: PageProps<"/admin/media">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const value: FilterValue = {
    q: one(sp.q),
    kind: (["image", "video", "pdf", "other"].includes(one(sp.type)) ? one(sp.type) : "") as FilterValue["kind"],
    albumId: Number(one(sp.album)) || 0,
    season: Number(one(sp.season)) || 0,
    used: (["used", "unused"].includes(one(sp.used)) ? one(sp.used) : "") as FilterValue["used"],
    sort: (["old", "big", "name"].includes(one(sp.sort)) ? one(sp.sort) : "new") as MediaSort,
  };
  const filters: MediaFilters = {
    q: value.q,
    kinds: value.kind ? [value.kind as MediaKind] : [],
    albumId: value.albumId,
    season: value.season,
    used: value.used,
    sort: value.sort,
  };
  const [{ items, more }, matching, total, albums, seasons] = await Promise.all([
    searchMedia(filters, { limit: PAGE, offset: (page - 1) * PAGE }),
    countMedia(filters),
    countMedia({}),
    all<{ id: number; title: string; season_year: number | null }>("SELECT id, title, season_year FROM albums ORDER BY season_year IS NULL, season_year DESC, sort_order"),
    getSeasonYears(),
  ]);
  const usage = await getMediaUsage(items.map((m) => m.id));
  const filtered = matching.n !== total.n;
  const pageLink = (p: number) => {
    const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k === "page" || v === undefined ? [] : [[k, one(v)]])));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/media?${qs}` : "/admin/media";
  };

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description={`${total.n} files · ${formatBytes(total.bytes)} in the R2 bucket. Each file is stored once, exactly as uploaded; the site resizes photos on the fly. Click a file to see where it's used.`}
        actions={
          <>
            <Link href="/admin/media/duplicates" className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
              Find duplicates
            </Link>
            <Link href="/admin/export" className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
              Download everything
            </Link>
          </>
        }
      />
      <BulkUploader />
      <MediaPageFilters initial={value} albums={albums} seasons={seasons} />
      {filtered && (
        <p className="-mt-2 text-sm text-dust">
          {matching.n} of {total.n} files match · {formatBytes(matching.bytes)}
        </p>
      )}
      {items.length === 0 && <p className="rounded-md border border-dashed border-edge p-8 text-center text-sm text-dust">{filtered ? "No files match." : "No files yet."}</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {items.map((m) => {
          const original = originalUrl(m.r2_key) ?? "";
          const isImage = m.content_type.startsWith("image/");
          const uses = usage.get(m.id) ?? [];
          const preview = (big: boolean) =>
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(m.r2_key, big ? 960 : 640) ?? original} alt={m.alt} loading="lazy" className={big ? "max-h-full max-w-full object-contain" : "size-full object-cover"} />
            ) : isVideo(m.r2_key) ? (
              <video src={original} preload="metadata" muted controls={big} className={big ? "max-h-full max-w-full" : "size-full object-cover"} />
            ) : (
              <span className="font-label text-xs text-dust">{m.content_type === "application/pdf" ? "PDF" : m.content_type}</span>
            );
          const meta = `${formatBytes(m.size_bytes)}${m.width && m.height ? ` · ${m.width}×${m.height}` : ""} · ${formatDate(m.created_at)}`;
          const confirm = uses.length
            ? `Delete ${m.filename}? It's used in ${uses.length} ${uses.length === 1 ? "place" : "places"}, which will lose it: ${uses.map((u) => u.label).join("; ")}.`
            : `Delete ${m.filename}? It isn't used anywhere.`;
          return (
            <li key={m.id} className="min-w-0">
              <ModalItem
                look="card"
                title={m.filename}
                description={meta}
                size="lg"
                action={updateMediaAlt.bind(null, m.id)}
                destroy={{ label: "Delete file", confirm, action: deleteMedia.bind(null, m.id) }}
                row={
                  <>
                    <span className="hatch flex h-40 items-center justify-center overflow-hidden rounded">{preview(false)}</span>
                    <span className="flex min-w-0 items-start justify-between gap-2">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-sm font-semibold group-hover:text-hornet">{m.filename}</span>
                        <span className="font-label text-[11px] text-ash">{meta}</span>
                        <span>{uses.length ? <Badge>{`Used in ${uses.length} ${uses.length === 1 ? "place" : "places"}`}</Badge> : <Badge tone="muted">Not used</Badge>}</span>
                      </span>
                      <Pencil size={15} className="mt-0.5 shrink-0 text-dust group-hover:text-hornet" />
                    </span>
                  </>
                }
              >
                <div className="hatch flex h-[min(40vh,360px)] items-center justify-center overflow-hidden rounded">{preview(true)}</div>
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Where it&apos;s used</h3>
                  {uses.length === 0 ? (
                    <p className="text-sm text-dust">Nowhere. It&apos;s only in the library.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {uses.map((u) => (
                        <li key={u.label}>
                          <Link href={u.href} className="text-sm font-semibold text-hornet hover:text-hornet-hover">
                            {u.label} →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
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
      {(page > 1 || more) && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={pageLink(page - 1)} className="font-semibold text-hornet">
              ← Previous
            </Link>
          )}
          <span className="text-dust">
            Page {page} of {Math.max(1, Math.ceil(matching.n / PAGE))}
          </span>
          {more && (
            <Link href={pageLink(page + 1)} className="font-semibold text-hornet">
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
