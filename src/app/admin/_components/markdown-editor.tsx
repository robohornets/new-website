"use client";

import { useState, useTransition } from "react";
import { previewMarkdown } from "../impact/actions";

export function MarkdownEditor({ name, label = "Article", defaultValue }: { name: string; label?: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [html, setHtml] = useState("");
  const [pending, startTransition] = useTransition();

  function showPreview() {
    setTab("preview");
    startTransition(async () => setHtml(await previewMarkdown(value)));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span id={`${name}-label`} className="text-sm font-semibold">
          {label}
        </span>
        <div role="tablist" className="flex gap-1 rounded-md border border-line-strong p-0.5 text-sm">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            onClick={() => setTab("write")}
            className={`h-8 rounded px-3 ${tab === "write" ? "bg-raise text-bone" : "text-dust"}`}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            onClick={showPreview}
            className={`h-8 rounded px-3 ${tab === "preview" ? "bg-raise text-bone" : "text-dust"}`}
          >
            Preview
          </button>
        </div>
      </div>
      {/* The textarea stays in the form (hidden on preview) so its value is always submitted. */}
      <textarea
        name={name}
        aria-labelledby={`${name}-label`}
        value={value}
        data-default={defaultValue}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        hidden={tab === "preview"}
        className="w-full rounded-md border border-edge bg-ink px-3 py-3 font-mono text-sm leading-relaxed text-bone focus:border-hornet focus:outline-none"
      />
      {tab === "preview" && (
        <div className="min-h-[420px] rounded-md border border-line bg-ink p-5">
          {pending ? <p className="text-dust">Rendering…</p> : <div className="prose-hive" dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      )}
      <span className="text-xs text-dust">
        Markdown: **bold**, *italic*, [link](https://…), blank line between paragraphs, ## for headings, - for lists.
      </span>
    </div>
  );
}
