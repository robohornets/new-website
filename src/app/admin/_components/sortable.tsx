"use client";

import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin";
import { EditForm } from "./unsaved";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
export type SortableItem = { id: number; label: string; node: ReactNode };

/**
 * Lives inside the order's EditForm. Revert remounts the form's fields, which
 * remounts this, and that's the cue to put the list back in its saved order.
 */
function OrderField({ value, saved, onRemount }: { value: string; saved: string; onRemount: () => void }) {
  useLayoutEffect(onRemount, [onRemount]);
  return <input type="hidden" name="order" value={value} data-default={saved} readOnly />;
}

/**
 * A grid you can put in order: drag an item by its handle, or use its ◀ ▶
 * buttons (phones, keyboards). The new order goes through the save bar like
 * any other change. Items keep their own forms; the order has its own tiny
 * form beside them, since forms can't be nested.
 *
 * Items that show up later (a fresh upload, a new album) join at `newItems`.
 */
export function SortableGrid({
  items,
  action,
  className,
  newItems = "end",
}: {
  items: SortableItem[];
  action: Action;
  className: string;
  newItems?: "start" | "end";
}) {
  const savedIds = items.map((i) => i.id);
  const [moved, setMoved] = useState<number[] | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const backToSaved = useCallback(() => setMoved(null), []);

  // The current order: what was moved, kept up to date with the server's list.
  const known = new Set(savedIds);
  const kept = (moved ?? savedIds).filter((id) => known.has(id));
  const fresh = savedIds.filter((id) => !kept.includes(id));
  const order = newItems === "start" ? [...fresh, ...kept] : [...kept, ...fresh];
  const byId = new Map(items.map((i) => [i.id, i]));

  const move = (id: number, to: number) => {
    const from = order.indexOf(id);
    if (from === -1 || to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    setMoved(next);
  };

  return (
    <>
      {/* Holds only the order (and shows an error if saving it fails). */}
      <EditForm action={action}>
        <OrderField value={order.join(",")} saved={savedIds.join(",")} onRemount={backToSaved} />
      </EditForm>
      <ul className={className}>
        {order.map((id, index) => {
          const item = byId.get(id)!;
          return (
            <li
              key={id}
              draggable={armed === id}
              onDragStart={(e) => {
                setDragging(id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(id));
              }}
              onDragOver={(e) => {
                if (dragging === null) return;
                e.preventDefault();
                if (dragging !== id) move(dragging, index);
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={() => {
                setDragging(null);
                setArmed(null);
              }}
              className={`relative min-w-0 transition-opacity ${dragging === id ? "opacity-40" : ""}`}
            >
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-line-strong bg-ink/90 p-0.5 shadow">
                <button
                  type="button"
                  aria-label={`Move ${item.label} earlier`}
                  disabled={index === 0}
                  onClick={() => move(id, index - 1)}
                  className="flex size-8 items-center justify-center rounded text-sand hover:bg-raise hover:text-bone disabled:opacity-30"
                >
                  ◀
                </button>
                <span
                  title="Drag to reorder"
                  aria-hidden="true"
                  onPointerDown={() => setArmed(id)}
                  onPointerUp={() => setArmed(null)}
                  className="flex size-8 cursor-grab items-center justify-center rounded text-lg leading-none text-sand select-none hover:bg-raise hover:text-bone active:cursor-grabbing"
                >
                  ⠿
                </span>
                <button
                  type="button"
                  aria-label={`Move ${item.label} later`}
                  disabled={index === order.length - 1}
                  onClick={() => move(id, index + 1)}
                  className="flex size-8 items-center justify-center rounded text-sand hover:bg-raise hover:text-bone disabled:opacity-30"
                >
                  ▶
                </button>
              </div>
              {item.node}
            </li>
          );
        })}
      </ul>
    </>
  );
}
