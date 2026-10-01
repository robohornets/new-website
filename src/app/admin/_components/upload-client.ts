"use client";

// Everything the browser does to upload a file: read its pixel size, turn a
// video into an MP4 every browser can play, then send it straight to R2
// (or through the Worker when direct uploads aren't set up). See
// src/lib/upload.ts for the server side.

import { formatLimit, maxBytesFor } from "@/lib/media";

export type Uploaded = { id: number; r2_key: string; filename: string };

/** What's happening to the file right now, for progress messages. */
export type UploadStatus = { file: string; stage: "converting" | "uploading"; progress: number };
export type UploadOptions = { extra?: Record<string, string>; onStatus?: (s: UploadStatus) => void; onNote?: (note: string) => void };

// Some browsers leave File.type empty for HEIC photos from iPhones.
function guessType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    {
      heic: "image/heic",
      heif: "image/heif",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      mov: "video/quicktime",
      mp4: "video/mp4",
      m4v: "video/mp4",
      webm: "video/webm",
      pdf: "application/pdf",
    }[ext ?? ""] ?? "application/octet-stream"
  );
}

/**
 * The picture's size in pixels, read by the browser (it only needs the file's
 * header, not a full decode). Null when the browser can't tell, like HEIC
 * outside Safari; the server measures those itself.
 */
function pixelSize(file: File, type: string): Promise<{ width: number; height: number } | null> {
  const isImage = type.startsWith("image/") && type !== "image/svg+xml";
  const isVideo = type.startsWith("video/");
  if (!isImage && !isVideo) return Promise.resolve(null);
  return new Promise((resolve) => {
    const src = URL.createObjectURL(file);
    const done = (size: { width: number; height: number } | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(src);
      resolve(size && size.width > 0 && size.height > 0 ? size : null);
    };
    const timer = setTimeout(() => done(null), 4000);
    if (isImage) {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done(null);
      img.src = src;
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => done({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => done(null);
      video.src = src;
    }
  });
}

// ---- Videos ------------------------------------------------------------------------

const VENDOR_MEDIABUNNY = "/vendor/mediabunny.mjs";

/** Above this the converted video might not fit in a phone's memory; upload as is. */
const MAX_CONVERT_BYTES = 700 * 1024 * 1024;

/**
 * Turns a video into an MP4 with H.264 video and AAC audio, the one format
 * every browser plays. iPhones record HEVC (.mov), which Chrome on many
 * Windows and Android devices can't show. Uses the device's own video
 * encoder (WebCodecs), shrinks anything bigger than 1080p, and leaves files
 * that are already H.264 MP4 alone. If this device can't convert, returns
 * the original with a note saying why.
 */
async function prepareVideo(file: File, onProgress: (p: number) => void): Promise<{ file: File; note?: string }> {
  const keep = (why: string) => ({ file, note: `${file.name} was uploaded as it is: ${why} Some browsers may not be able to play it.` });
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
    return keep("this browser can't convert videos (try Chrome, Edge or Safari).");
  }
  if (file.size > MAX_CONVERT_BYTES) return keep("it's too big to convert in the browser.");

  // Loaded from public/vendor (scripts/copy-vendor.mjs) only when a video needs it, so it's in neither the
  // admin's JavaScript nor the Worker.
  // The address is built at run time so no bundler (Next's, or OpenNext's esbuild pass) tries to resolve it.
  const src = new URL(VENDOR_MEDIABUNNY, location.origin).href;
  const mb: typeof import("mediabunny") = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ src);
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) return keep("it has no video track.");
    const audio = await input.getPrimaryAudioTrack();
    const mime = await input.getMimeType();
    const short = Math.min(video.displayWidth, video.displayHeight);
    const playable = mime.startsWith("video/mp4") && video.codec === "avc" && (!audio || audio.codec === "aac") && short <= 1080;
    if (playable) return { file };

    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
    // Shrink the shorter side to 1080 (portrait phone videos included).
    const resize = short > 1080 ? (video.displayWidth <= video.displayHeight ? { width: 1080 } : { height: 1080 }) : {};
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { codec: "avc", quality: mb.QUALITY_HIGH, ...resize },
      audio: { codec: "aac" },
      showWarnings: false,
    });
    if (!conversion.isValid) return keep("this device can't convert this video.");
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) return keep("the conversion produced nothing.");
    const name = file.name.replace(/\.[^.]+$/, "") + ".mp4";
    return { file: new File([buffer], name, { type: "video/mp4" }) };
  } catch (e) {
    console.error("video conversion failed", e);
    return keep("converting it failed.");
  } finally {
    input.dispose?.();
  }
}

// ---- Sending ----------------------------------------------------------------------

/** PUT with upload progress (fetch can't report it). */
function put(url: string, file: File, type: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the file (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.send(file);
  });
}

async function postJson<T>(path: string, body: unknown): Promise<{ res: Response; json: T }> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { res, json: (await res.json().catch(() => ({}))) as T };
}

// Remembered for the page's lifetime once the server says direct uploads aren't set up.
let directAvailable = true;

async function uploadOne(original: File, { extra = {}, onStatus, onNote }: UploadOptions): Promise<Uploaded> {
  let file = original;
  let type = file.type || guessType(file.name);
  if (type.startsWith("video/")) {
    onStatus?.({ file: file.name, stage: "converting", progress: 0 });
    const prepared = await prepareVideo(file, (p) => onStatus?.({ file: original.name, stage: "converting", progress: p }));
    file = prepared.file;
    type = file.type || guessType(file.name);
    if (prepared.note) onNote?.(prepared.note);
  }
  const size = await pixelSize(file, type);
  const dims = size ? { width: size.width, height: size.height } : {};
  const status = (progress: number) => onStatus?.({ file: original.name, stage: "uploading", progress });
  status(0);

  if (directAvailable) {
    const start = await postJson<{ key?: string; url?: string; exp?: number; receipt?: string; error?: string; direct?: boolean }>(
      "/admin/api/upload/start",
      { filename: file.name, type, size: file.size },
    );
    if (start.res.status === 501 || start.res.status === 404) {
      directAvailable = false;
    } else if (!start.res.ok || !start.json.url) {
      throw new Error(start.json.error ?? `Upload failed (${start.res.status})`);
    } else {
      try {
        await put(start.json.url, file, type, status);
      } catch (e) {
        // Usually the bucket's CORS rule is missing or wrong (see "Direct
        // uploads" in the README). Small enough files still go through the Worker.
        console.error("direct upload failed", e);
        if (file.size > maxBytesFor(type, false)) {
          throw new Error(`${file.name} couldn't be sent to storage. Check your connection; if it keeps happening, check the R2 CORS rule (README, "Direct uploads").`);
        }
        directAvailable = false;
        return sendThroughWorker(file, type, size, extra, status);
      }
      const finish = await postJson<{ media?: Uploaded; error?: string }>("/admin/api/upload/finish", {
        key: start.json.key,
        exp: start.json.exp,
        receipt: start.json.receipt,
        filename: file.name,
        type,
        size: file.size,
        ...dims,
        ...extra,
      });
      if (!finish.res.ok || !finish.json.media) throw new Error(finish.json.error ?? `Upload failed (${finish.res.status})`);
      return finish.json.media;
    }
  }

  return sendThroughWorker(file, type, size, extra, status);
}

/** Through the Worker: the file is the whole request body, so it streams into R2. */
async function sendThroughWorker(
  file: File,
  type: string,
  size: { width: number; height: number } | null,
  extra: Record<string, string>,
  status: (p: number) => void,
): Promise<Uploaded> {
  const max = maxBytesFor(type, false);
  if (file.size > max) {
    throw new Error(`${file.name} is larger than ${formatLimit(max)}. Bigger videos need direct uploads (see the README) or YouTube.`);
  }
  const params = new URLSearchParams({ filename: file.name, ...(size ? { width: String(size.width), height: String(size.height) } : {}), ...extra });
  const res = await fetch(`/admin/api/upload?${params}`, { method: "POST", body: file, headers: { "content-type": type } });
  const json = (await res.json().catch(() => ({}))) as { media?: Uploaded; error?: string };
  if (!res.ok || !json.media) throw new Error(json.error ?? `Upload failed (${res.status})`);
  status(1);
  return json.media;
}

/** Uploads files one at a time; throws on the first that fails. */
export async function uploadFiles(files: File[], extraOrOptions: Record<string, string> | UploadOptions = {}): Promise<Uploaded[]> {
  const options: UploadOptions =
    "extra" in extraOrOptions || "onStatus" in extraOrOptions || "onNote" in extraOrOptions
      ? (extraOrOptions as UploadOptions)
      : { extra: extraOrOptions as Record<string, string> };
  const out: Uploaded[] = [];
  for (const file of files) out.push(await uploadOne(file, options));
  return out;
}
