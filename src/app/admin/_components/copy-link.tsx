"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** Shows the full address of a page on this site, with Copy and Open buttons. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  // The server doesn't know which domain the admin is on; the browser does.
  const url = useSyncExternalStore(noSubscribe, () => `${window.location.origin}${path}`, () => path);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-md border border-line bg-ink px-3 py-2 font-mono text-sm">
        {url}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a href={path} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center px-2 text-sm font-semibold text-hornet hover:text-hornet-hover">
        Open the form
      </a>
    </div>
  );
}
