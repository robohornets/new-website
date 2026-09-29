"use client";

import { Zip, ZipPassThrough } from "fflate";
import { useState, useSyncExternalStore } from "react";
import { formatBytes } from "@/lib/format";

type ManifestFile = { id: number; r2_key: string; filename: string; content_type: string; size_bytes: number; url: string };

// Minimal File System Access API types (Chrome/Edge); not in TypeScript's DOM lib.
type Writable = WritableStream<Uint8Array>;
type FileHandle = { getFile(): Promise<File>; createWritable(): Promise<Writable> };
type DirHandle = {
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
};
type PickerWindow = Window & { showDirectoryPicker?: (opts?: { mode?: "readwrite" }) => Promise<DirHandle> };

/**
 * Downloads every uploaded file exactly as it was uploaded (no resizing). With
 * Chrome/Edge it writes into a folder you pick and skips files already there,
 * so it can be resumed. Other browsers get one .zip (stored, not recompressed).
 */
export function OriginalsDownloader({ totalFiles, totalBytes }: { totalFiles: number; totalBytes: number }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, bytes: 0 });

  async function manifest(): Promise<ManifestFile[]> {
    const res = await fetch("/admin/api/export?manifest=1");
    if (!res.ok) throw new Error(`Couldn't load the file list (${res.status}).`);
    return res.json();
  }

  async function toFolder() {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) return;
    setBusy(true);
    setStatus(null);
    try {
      const root = await picker({ mode: "readwrite" });
      const files = await manifest();
      setProgress({ done: 0, total: files.length, bytes: 0 });
      let skipped = 0;
      const failed: string[] = [];
      for (const f of files) {
        try {
          const parts = f.r2_key.split("/");
          const name = parts.pop()!;
          let dir = root;
          for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
          const handle = await dir.getFileHandle(name, { create: true });
          const existing = await handle.getFile();
          if (existing.size === f.size_bytes && f.size_bytes > 0) {
            skipped++;
          } else {
            const res = await fetch(f.url);
            if (!res.ok || !res.body) throw new Error(String(res.status));
            await res.body.pipeTo(await handle.createWritable());
          }
        } catch {
          failed.push(f.filename);
        }
        setProgress((p) => ({ ...p, done: p.done + 1, bytes: p.bytes + f.size_bytes }));
      }
      // A readable index of what each stored file was called when uploaded.
      const index = await root.getFileHandle("files.json", { create: true });
      const w = await index.createWritable();
      await new Blob([JSON.stringify(files, null, 2)]).stream().pipeTo(w);
      setStatus(
        `Done: ${files.length - skipped - failed.length} downloaded, ${skipped} already there${failed.length ? `, ${failed.length} failed (${failed.slice(0, 5).join(", ")}…). Run it again to retry.` : "."}`,
      );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setStatus(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toZip() {
    setBusy(true);
    setStatus(null);
    try {
      const files = await manifest();
      setProgress({ done: 0, total: files.length, bytes: 0 });
      const chunks: Uint8Array[] = [];
      const finished = new Promise<void>((resolve, reject) => {
        const zip = new Zip((err, chunk, final) => {
          if (err) return reject(err);
          chunks.push(chunk);
          if (final) resolve();
        });
        (async () => {
          const index = new ZipPassThrough("files.json");
          zip.add(index);
          index.push(new TextEncoder().encode(JSON.stringify(files, null, 2)), true);
          for (const f of files) {
            const res = await fetch(f.url);
            if (!res.ok || !res.body) continue;
            // Photos and videos are already compressed, so they're stored as-is.
            const entry = new ZipPassThrough(f.r2_key);
            zip.add(entry);
            const reader = res.body.getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              entry.push(value);
            }
            entry.push(new Uint8Array(0), true);
            setProgress((p) => ({ ...p, done: p.done + 1, bytes: p.bytes + f.size_bytes }));
          }
          zip.end();
        })().catch(reject);
      });
      await finished;
      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `btwrobotics-originals-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setStatus(`Zipped ${files.length} files.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  // Read after hydration so the server-rendered HTML matches the first client render.
  const canPickFolder = useSyncExternalStore(
    () => () => {},
    () => "showDirectoryPicker" in window,
    () => false,
  );
  const bigForZip = totalBytes > 1.5 * 1024 * 1024 * 1024;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={toFolder}
          disabled={busy || !canPickFolder}
          className="flex h-11 items-center rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-amber disabled:opacity-50"
          title={canPickFolder ? undefined : "Needs Chrome or Edge"}
        >
          Save all originals to a folder
        </button>
        <button
          type="button"
          onClick={toZip}
          disabled={busy || totalFiles === 0}
          className="flex h-11 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone disabled:opacity-50"
        >
          Download all originals as .zip
        </button>
      </div>
      <p className="text-xs text-dust">
        {totalFiles} files, {formatBytes(totalBytes)}.{" "}
        {canPickFolder
          ? "The folder option is best for big libraries: it streams to disk and skips files you already have, so you can re-run it."
          : "Folder saving needs Chrome or Edge."}
        {bigForZip && " The .zip is built in memory, so for a library this size use the folder option or the rclone command below."}
      </p>
      {busy && (
        <p role="status" className="font-mono text-sm text-amber">
          {progress.done} / {progress.total} files · {formatBytes(progress.bytes)}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm text-sand">
          {status}
        </p>
      )}
    </div>
  );
}
