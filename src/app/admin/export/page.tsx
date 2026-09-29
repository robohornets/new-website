import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { first } from "@/lib/db";
import { EXPORT_TABLES } from "@/lib/export";
import { AdminPageHeader, Panel } from "../_components/fields";
import { OriginalsDownloader } from "./originals-downloader";

export const metadata: Metadata = { title: "Export & backup" };

export default async function AdminExportPage() {
  await requireAdminPage();
  const media = await first<{ n: number; bytes: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM media");

  return (
    <>
      <AdminPageHeader
        title="Export & backup"
        description="Take everything with you: the site's content as data, and every uploaded file exactly as it was uploaded."
      />

      <Panel
        title="All content (JSON)"
        description="One file with every table: seasons, robots, events, roster, posts, sponsors, albums, settings, messages and the media list. It also includes the database schema, so it can be loaded into another system."
      >
        <a
          href="/admin/api/export"
          className="flex h-11 items-center self-start rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-hornet-hover"
        >
          Download content export
        </a>
      </Panel>

      <Panel
        title="Original photos & videos"
        description="The files in the R2 bucket, byte for byte. The resized versions the site shows are made on the fly and never stored, so there is exactly one file per upload."
      >
        <OriginalsDownloader totalFiles={media?.n ?? 0} totalBytes={media?.bytes ?? 0} />
        <p className="text-xs text-dust">
          Single files: use <em>Download original</em> in the Media library or on an album.
        </p>
      </Panel>

      <Panel title="Spreadsheets (CSV)" description="One table at a time, for Excel or Google Sheets.">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {EXPORT_TABLES.map((t) => (
            <li key={t.name}>
              <a
                href={`/admin/api/export?table=${t.name}&csv=1`}
                className="flex h-11 items-center justify-between gap-3 rounded-md border border-line bg-ink px-3 text-sm hover:border-edge"
              >
                <span>{t.label}</span>
                <span className="font-label text-[11px] text-ash">.csv</span>
              </a>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="From the command line" description="For whoever maintains the site. These need a Cloudflare login with access to the account.">
        <div className="flex flex-col gap-4 text-sm text-sand">
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-bone">Full SQL dump of the database</span>
            <code className="overflow-x-auto rounded bg-ink px-3 py-2 font-mono text-[13px] whitespace-nowrap">
              npx wrangler d1 export DB --remote --output btwrobotics.sql
            </code>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-bone">Copy the whole R2 bucket (any size)</span>
            <code className="overflow-x-auto rounded bg-ink px-3 py-2 font-mono text-[13px] whitespace-nowrap">
              rclone copy r2:btwrobotics-media ./btwrobotics-media --progress
            </code>
            <span className="text-xs text-dust">
              Set up an <span className="font-mono">r2</span> rclone remote with an R2 API token first (R2 → Manage API tokens). See the README.
            </span>
          </div>
        </div>
      </Panel>
    </>
  );
}
