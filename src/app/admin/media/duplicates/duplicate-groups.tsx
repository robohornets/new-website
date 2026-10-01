"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DuplicateGroup } from "@/lib/duplicates";
import { formatBytes, formatDate } from "@/lib/format";
import { isVideo, mediaUrl, originalUrl } from "@/lib/media";
import { fingerprintStored } from "../../_components/fingerprint";
import { buttonStyles } from "../../_components/items";
import { useConfirm } from "../../_components/modal";
import { markDistinct, mergeMedia, nextToFingerprint, saveFingerprints } from "../actions";

/**
 * Photos uploaded before duplicate checks have no fingerprint yet: the
 * browser works them out from each photo's small preview, a batch at a time.
 */
function Scanner({ unhashed }: { unhashed: number }) {
  const router = useRouter();
  const [done, setDone] = useState<number | null>(null);
  const [, startRefresh] = useTransition();

  async function scan() {
    setDone(0);
    let count = 0;
    for (;;) {
      const batch = await nextToFingerprint();
      if (!batch.length) break;
      const prints = await Promise.all(batch.map(async (m) => ({ id: m.id, phash: await fingerprintStored(mediaUrl(m.r2_key, 320) ?? "") })));
      await saveFingerprints(prints);
      count += batch.length;
      setDone(count);
    }
    startRefresh(() => router.refresh());
    setDone(null);
  }

  if (unhashed === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line-strong bg-raise p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span aria-live="polite">
        {done === null
          ? `${unhashed} ${unhashed === 1 ? "photo was" : "photos were"} uploaded before duplicate checks and ${unhashed === 1 ? "hasn't" : "haven't"} been looked at yet. Scan them to find their copies too.`
          : `Looking at photos… ${done} of ${unhashed}. Keep this page open.`}
      </span>
      <button type="button" onClick={() => void scan()} disabled={done !== null} className={`${buttonStyles.primary} shrink-0`}>
        {done === null ? `Scan ${unhashed} ${unhashed === 1 ? "photo" : "photos"}` : "Scanning…"}
      </button>
    </div>
  );
}

function Group({ group, onDone }: { group: DuplicateGroup; onDone: (message: string) => void }) {
  const [keep, setKeep] = useState(group.keep);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const others = group.files.filter((f) => f.id !== keep);
  const lost = others.flatMap((f) => f.uses.map((u) => u.label));

  return (
    <li className="flex flex-col gap-4 rounded-md border border-line bg-panel p-4">
      <p className="text-sm text-dust">
        {group.files.length} {group.exact ? "copies of the same file" : "photos that look the same"}. Pick the one to keep.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {group.files.map((f) => {
          const chosen = f.id === keep;
          return (
            <li key={f.id} className="min-w-0">
              <label className={`flex h-full cursor-pointer flex-col gap-2 rounded-md border-2 p-2 ${chosen ? "border-hornet bg-hornet/5" : "border-line hover:border-edge"}`}>
                <span className="hatch block aspect-square w-full overflow-hidden rounded">
                  {isVideo(f.r2_key) ? (
                    <video src={`${originalUrl(f.r2_key) ?? ""}#t=0.5`} preload="metadata" muted className="size-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(f.r2_key, 320) ?? ""} alt="" loading="lazy" className="size-full object-cover" />
                  )}
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input type="radio" name={`keep-${group.keep}`} checked={chosen} onChange={() => setKeep(f.id)} className="accent-hornet" />
                  {chosen ? "Keep this one" : "Keep"}
                </span>
                <span className="truncate text-xs text-sand" title={f.filename}>
                  {f.filename}
                </span>
                <span className="font-label text-[11px] text-ash">
                  {formatBytes(f.size_bytes)}
                  {f.width && f.height ? ` · ${f.width}×${f.height}` : ""} · {formatDate(f.created_at)}
                </span>
                {f.uses.length === 0 ? (
                  <span className="text-xs text-ash">Not used anywhere</span>
                ) : (
                  <ul className="flex flex-col gap-0.5 text-xs">
                    {f.uses.slice(0, 4).map((u) => (
                      <li key={u.label}>
                        <Link href={u.href} className="text-hornet hover:text-hornet-hover">
                          {u.label}
                        </Link>
                      </li>
                    ))}
                    {f.uses.length > 4 && <li className="text-ash">and {f.uses.length - 4} more</li>}
                  </ul>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          className={buttonStyles.primary}
          onClick={async () => {
            const ok = await confirm({
              title: "Merge these copies?",
              message: `${others.length === 1 ? "The other copy is" : `The other ${others.length} copies are`} deleted.${
                lost.length ? ` Everything that used ${others.length === 1 ? "it" : "them"} switches to the one you kept: ${lost.join("; ")}.` : ""
              }`,
              confirmLabel: "Merge",
            });
            if (!ok) return;
            start(async () => {
              const r = await mergeMedia(keep, others.map((o) => o.id));
              if (r.ok) onDone(r.message ?? "Merged.");
              else setError(r.error ?? "That didn't work.");
            });
          }}
        >
          {pending ? "Merging…" : `Keep the one picked, remove ${others.length === 1 ? "the copy" : `${others.length} copies`}`}
        </button>
        <button
          type="button"
          disabled={pending}
          className="h-10 px-2 text-sm text-dust hover:text-bone"
          onClick={() =>
            start(async () => {
              const r = await markDistinct(group.files.map((f) => f.id));
              if (r.ok) onDone(r.message ?? "Kept apart.");
            })
          }
        >
          They&apos;re different photos
        </button>
        {error && (
          <span role="alert" className="text-sm text-danger">
            {error}
          </span>
        )}
      </div>
    </li>
  );
}

/** Each group of copies, with the suggested one to keep picked. */
export function DuplicateGroups({ groups, unhashed }: { groups: DuplicateGroup[]; unhashed: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [all, startAll] = useTransition();
  const confirm = useConfirm();
  const copies = groups.reduce((n, g) => n + g.files.length - 1, 0);

  return (
    <div className="flex flex-col gap-5">
      <Scanner unhashed={unhashed} />
      {message && (
        <p role="status" className="text-sm text-sand">
          {message}
        </p>
      )}
      {groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-8 text-center text-sm text-dust">
          {unhashed ? "No duplicates found yet. Scan the older photos above to check them too." : "No duplicates. Every file is in the library once."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-dust">
              {groups.length} {groups.length === 1 ? "group" : "groups"} · {copies} extra {copies === 1 ? "copy" : "copies"}
            </p>
            <button
              type="button"
              disabled={all}
              className={buttonStyles.secondary}
              onClick={async () => {
                const ok = await confirm({
                  title: "Merge every group?",
                  message: `Keeps the suggested file in each of the ${groups.length} groups (the most used, then the biggest), swaps it in everywhere for its copies, and deletes the ${copies} copies. Check the groups first if you're unsure.`,
                  confirmLabel: "Merge all",
                });
                if (!ok) return;
                startAll(async () => {
                  let merged = 0;
                  for (const g of groups) {
                    const r = await mergeMedia(g.keep, g.files.filter((f) => f.id !== g.keep).map((f) => f.id));
                    if (r.ok) merged++;
                  }
                  setMessage(`Merged ${merged} ${merged === 1 ? "group" : "groups"}.`);
                  router.refresh();
                });
              }}
            >
              {all ? "Merging…" : "Merge all, keeping the suggested ones"}
            </button>
          </div>
          <ul className="flex flex-col gap-4">
            {groups.map((g) => (
              <Group
                key={g.files.map((f) => f.id).join("-")}
                group={g}
                onDone={(m) => {
                  setMessage(m);
                  router.refresh();
                }}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
