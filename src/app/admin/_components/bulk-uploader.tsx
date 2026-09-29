"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "@/components/icons";
import { uploadFiles } from "./media-field";

/** Drag-and-drop or pick many files; uploads them one by one to R2. */
export function BulkUploader({ albumId, label = "Upload photos" }: { albumId?: number; label?: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  async function handle(files: File[]) {
    if (!files.length) return;
    setErrors([]);
    setProgress({ done: 0, total: files.length });
    const failed: string[] = [];
    for (const file of files) {
      try {
        await uploadFiles([file], albumId ? { album_id: String(albumId) } : {});
      } catch (e) {
        failed.push(e instanceof Error ? e.message : `${file.name} failed`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setErrors(failed);
    setProgress(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(Array.from(e.dataTransfer.files));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed px-6 py-10 text-center ${
          dragging ? "border-hornet bg-hornet/5" : "border-edge hover:border-bone"
        }`}
      >
        <Upload className="text-hornet" size={28} />
        <span className="font-semibold">{progress ? `Uploading ${progress.done} of ${progress.total}…` : label}</span>
        <span className="text-xs text-dust">Drop files here or click to choose. Photos (JPG, PNG, HEIC, WebP…) up to 20 MB, videos (MP4, MOV, WebM) up to 95 MB. Files are kept exactly as uploaded.</span>
        <input
          type="file"
          multiple
          accept="image/*,.heic,.heif,video/mp4,video/webm,video/quicktime,application/pdf"
          className="sr-only"
          disabled={Boolean(progress)}
          onChange={(e) => {
            void handle(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-danger">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
