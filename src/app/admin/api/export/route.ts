import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { all, run } from "@/lib/db";
import { buildExport, EXPORT_TABLES, exportTable, toCsv } from "@/lib/export";
import { originalUrl } from "@/lib/media";

// GET /admin/api/export                      everything, as one JSON file
// GET /admin/api/export?table=people&csv=1   one table as CSV (opens in Excel/Sheets)
// GET /admin/api/export?manifest=1           list of original files, for the downloader
export async function GET(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const date = new Date().toISOString().slice(0, 10);
  const headers = { "cache-control": "no-store" };

  if (url.searchParams.has("manifest")) {
    const files = await all<{ id: number; r2_key: string; filename: string; content_type: string; size_bytes: number }>(
      "SELECT id, r2_key, filename, content_type, size_bytes FROM media ORDER BY id",
    );
    return Response.json(
      files.map((f) => ({ ...f, url: originalUrl(f.r2_key) })),
      { headers },
    );
  }

  const table = url.searchParams.get("table");
  if (table) {
    if (!EXPORT_TABLES.some((t) => t.name === table)) return Response.json({ error: "Unknown table." }, { status: 400 });
    const rows = await exportTable(table, origin);
    if (url.searchParams.has("csv")) {
      // The BOM makes Excel read the file as UTF-8.
      return new Response(`﻿${toCsv(rows)}`, {
        headers: {
          ...headers,
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="btwrobotics-${table}-${date}.csv"`,
        },
      });
    }
    return Response.json(rows, { headers });
  }

  const data = await buildExport(origin, user.email);
  await run("INSERT INTO audit_log (actor, action, entity) VALUES (?, 'export', 'all')", user.email);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...headers,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="btwrobotics-export-${date}.json"`,
    },
  });
}
