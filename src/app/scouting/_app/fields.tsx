"use client";

import type { ScoutingData, ScoutingField, ScoutingValue } from "@/lib/scouting";

const input =
  "h-12 w-full rounded-md border border-edge bg-ink px-3.5 text-base text-bone placeholder:text-ash focus:border-hornet focus:outline-none";
const pill = (on: boolean) =>
  `flex min-h-11 items-center justify-center rounded-md border px-4 text-[15px] font-semibold ${
    on ? "border-hornet bg-hornet text-ink" : "border-line-strong text-sand hover:border-bone hover:text-bone"
  }`;

/** One question, sized for thumbs. `onChange(undefined)` clears the answer. */
export function FieldInput({
  field: f,
  value,
  onChange,
}: {
  field: ScoutingField;
  value: ScoutingValue | undefined;
  onChange: (value: ScoutingValue | undefined) => void;
}) {
  switch (f.type) {
    case "counter": {
      const n = typeof value === "number" ? value : 0;
      return (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onChange(Math.max(0, n - 1) || undefined)} aria-label={`${f.label}: minus one`} className="flex size-14 items-center justify-center rounded-md border border-line-strong text-2xl font-bold text-sand active:bg-raise">
            −
          </button>
          <output className="w-14 text-center font-display text-4xl leading-none font-extrabold" aria-live="polite">
            {n}
          </output>
          <button type="button" onClick={() => onChange(Math.min(999, n + 1))} aria-label={`${f.label}: plus one`} className="flex size-14 items-center justify-center rounded-md bg-hornet text-2xl font-bold text-ink active:bg-hornet-hover">
            +
          </button>
        </div>
      );
    }
    case "toggle":
      return (
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(value === v ? undefined : v)} className={pill(value === v)}>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      );
    case "choice":
      return (
        <div className="flex flex-wrap gap-2">
          {(f.options ?? []).map((o) => (
            <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? undefined : o)} className={pill(value === o)}>
              {o}
            </button>
          ))}
        </div>
      );
    case "multi": {
      const list = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {(f.options ?? []).map((o) => {
            const on = list.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on ? list.filter((x) => x !== o) : [...list, o];
                  onChange(next.length ? next : undefined);
                }}
                className={pill(on)}
              >
                {on ? "✓ " : ""}
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "rating": {
      const n = typeof value === "number" ? value : 0;
      return (
        <div className="flex gap-1" role="radiogroup" aria-label={f.label}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={n === i}
              aria-label={`${i} of 5`}
              onClick={() => onChange(n === i ? undefined : i)}
              className={`flex size-12 items-center justify-center rounded-md text-3xl ${i <= n ? "text-hornet" : "text-edge hover:text-ash"}`}
            >
              ★
            </button>
          ))}
        </div>
      );
    }
    case "number":
      return (
        <div className="flex items-center gap-2 sm:max-w-xs">
          <input
            type="number"
            inputMode="decimal"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            className={input}
            aria-label={f.label}
          />
          {f.unit && <span className="text-sand">{f.unit}</span>}
        </div>
      );
    case "text":
      return (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          maxLength={200}
          className={input}
          aria-label={f.label}
        />
      );
    case "longtext":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          rows={4}
          maxLength={3000}
          className={`${input} h-auto py-3`}
          aria-label={f.label}
        />
      );
    default:
      return null;
  }
}

/** All of a form's questions, with its headings. */
export function FormFields({ fields, data, onChange }: { fields: ScoutingField[]; data: ScoutingData; onChange: (id: string, v: ScoutingValue | undefined) => void }) {
  if (fields.length === 0) return <p className="text-sm text-dust">This part of the form has no questions yet. An admin can add them.</p>;
  return (
    <div className="flex flex-col gap-6">
      {fields.map((f) =>
        f.type === "section" ? (
          <h3 key={f.id} className="-mb-2 border-t border-line pt-5 font-display text-2xl font-extrabold uppercase first:border-t-0 first:pt-0">
            {f.label}
          </h3>
        ) : (
          <div key={f.id} className="flex flex-col gap-2">
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{f.label}</span>
              {f.help && <span className="text-sm text-dust">{f.help}</span>}
            </span>
            <FieldInput field={f} value={data[f.id]} onChange={(v) => onChange(f.id, v)} />
          </div>
        ),
      )}
    </div>
  );
}
