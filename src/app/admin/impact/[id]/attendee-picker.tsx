"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "../../_components/fields";

export type PickerPerson = { id: number; name: string; detail: string; group: string };

const hoursClass = `${inputClass.replace("w-full", "w-24")} h-10 text-right tabular-nums`;

function parseHours(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const clock = /^(\d+):([0-5]\d)$/.exec(v);
  const n = clock ? Number(clock[1]) + Number(clock[2]) / 60 : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Tick who went. Everyone gets the whole event unless you type their own
 * hours (someone who left early, or stayed to pack up). Filtering only hides
 * rows; every box is still in the form, so nothing is lost while searching.
 */
export function AttendeePicker({
  people,
  logged,
  eventHours,
}: {
  people: PickerPerson[];
  /** person id → their own hours, or null for "the whole event". */
  logged: Record<number, number | null>;
  eventHours: number | null;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [going, setGoing] = useState<ReadonlySet<number>>(() => new Set(Object.keys(logged).map(Number)));
  const [custom, setCustom] = useState<Record<number, number | null>>(logged);
  const [length, setLength] = useState<number | null>(eventHours);

  // Follow the event's "How long" box (elsewhere in the same form) so the
  // placeholders and the total stay right while it's being edited.
  useEffect(() => {
    const form = listRef.current?.closest("form");
    if (!form) return;
    const onInput = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.name === "outreach_hours") setLength(parseHours(t.value));
    };
    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (p: PickerPerson) => !q || p.name.toLowerCase().includes(q) || p.detail.toLowerCase().includes(q);
  const groups = [...new Set(people.map((p) => p.group))];
  const total = [...going].reduce((sum, id) => sum + (custom[id] ?? length ?? 0), 0);

  // Real clicks, so the save bar and React both see the change.
  const setShown = (on: boolean) => {
    for (const box of listRef.current?.querySelectorAll<HTMLInputElement>('input[name="went"]') ?? []) {
      if (box.closest("[hidden]")) continue;
      if (box.checked !== on) box.click();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find someone"
          aria-label="Find someone"
          // Not a saved field: no name, so the save bar ignores it.
          className={`${inputClass.replace("w-full", "w-full sm:w-64")}`}
        />
        <button
          type="button"
          onClick={() => setShown(true)}
          className="flex h-11 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
        >
          Tick {q ? "shown" : "everyone"}
        </button>
        <button type="button" onClick={() => setShown(false)} className="flex h-11 items-center px-2 text-sm font-semibold text-sand hover:text-bone hover:underline">
          Clear {q ? "shown" : "all"}
        </button>
        <p className="ml-auto font-label text-sm text-sand" aria-live="polite">
          <strong className="text-bone">{going.size}</strong> {going.size === 1 ? "person" : "people"} ·{" "}
          <strong className="text-bone">{fmt(total)}</strong> hours
        </p>
      </div>

      <div ref={listRef} className="flex flex-col gap-6">
        {groups.map((group) => {
          const members = people.filter((p) => p.group === group);
          const shown = members.filter(matches);
          return (
            <section key={group} hidden={shown.length === 0} className="flex flex-col gap-2">
              <h3 className="flex items-baseline gap-3">
                <span className="eyebrow text-[11px] text-ash">{group}</span>
                <span className="font-label text-xs text-ash">
                  {members.filter((m) => going.has(m.id)).length} of {members.length}
                </span>
              </h3>
              <ul className="grid gap-1.5 md:grid-cols-2">
                {members.map((p) => {
                  const on = going.has(p.id);
                  return (
                    <li
                      key={p.id}
                      hidden={!matches(p)}
                      className={`flex min-w-0 items-center gap-3 rounded-md border px-3 py-1.5 ${on ? "border-edge bg-raise" : "border-line"}`}
                    >
                      <label className="flex min-w-0 grow cursor-pointer items-center gap-3 py-1.5">
                        <input
                          type="checkbox"
                          name="went"
                          value={p.id}
                          defaultChecked={p.id in logged}
                          onChange={(e) => {
                            const checked = e.currentTarget.checked;
                            setGoing((s) => {
                              const next = new Set(s);
                              if (checked) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            });
                          }}
                          className="size-5 shrink-0 accent-hornet"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold">{p.name}</span>
                          {p.detail && <span className="truncate text-xs text-dust">{p.detail}</span>}
                        </span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        name={`hours_${p.id}`}
                        defaultValue={logged[p.id] == null ? "" : fmt(logged[p.id]!)}
                        placeholder={length == null ? "hrs" : fmt(length)}
                        aria-label={`Hours for ${p.name} (blank for the whole event)`}
                        disabled={!on}
                        onChange={(e) => {
                          const v = parseHours(e.currentTarget.value);
                          setCustom((c) => ({ ...c, [p.id]: v }));
                        }}
                        className={`${hoursClass} ${on ? "" : "opacity-40"}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {q && people.every((p) => !matches(p)) && <p className="text-sm text-dust">Nobody matches &ldquo;{query}&rdquo;.</p>}
      </div>
    </div>
  );
}
