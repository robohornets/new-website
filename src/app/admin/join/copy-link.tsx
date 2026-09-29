"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** Shows the full /join address and copies it. */
export function CopyJoinLink() {
  const [copied, setCopied] = useState(false);
  // The server doesn't know which domain the admin is on; the browser does.
  const url = useSyncExternalStore(noSubscribe, () => `${window.location.origin}/join`, () => "/join");
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
      <a href="/join" target="_blank" rel="noopener noreferrer" className="flex h-10 items-center px-2 text-sm font-semibold text-hornet hover:text-hornet-hover">
        Open the form
      </a>
    </div>
  );
}
