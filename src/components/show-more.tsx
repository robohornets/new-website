"use client";

import { useState, type ReactNode } from "react";

/**
 * Shows the first few items and a "Show all N" button for the rest.
 * `as="tbody"` puts the button in a full-width table row.
 */
export function ShowMore({
  items,
  initial = 5,
  noun = "items",
  as: Tag = "ul",
  className = "",
  columns = 1,
}: {
  items: ReactNode[];
  initial?: number;
  noun?: string;
  as?: "ul" | "tbody";
  className?: string;
  /** Table columns, for the button row. */
  columns?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = items.length - initial;
  const visible = expanded || hidden <= 0 ? items : items.slice(0, initial);
  const toggle =
    hidden > 0 ? (
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-5 text-sm font-semibold text-sand hover:border-bone hover:text-bone"
      >
        {expanded ? "Show fewer" : `Show all ${items.length} ${noun}`}
        <span aria-hidden="true" className={`text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
    ) : null;

  if (Tag === "tbody") {
    return (
      <tbody className={className}>
        {visible}
        {toggle && (
          <tr>
            <td colSpan={columns} className="px-5 py-4">
              {toggle}
            </td>
          </tr>
        )}
      </tbody>
    );
  }
  return (
    <>
      <ul className={className}>{visible}</ul>
      {toggle && <div className="mt-6 flex justify-center">{toggle}</div>}
    </>
  );
}
