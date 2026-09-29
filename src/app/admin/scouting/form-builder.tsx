"use client";

import { useState } from "react";
import { FIELD_TYPES, newFieldId, type FieldType, type ScoutingField, type ScoutingForm } from "@/lib/scouting";
import { inputClass } from "../_components/fields";
import { useConfirm } from "../_components/modal";

type Part = "robot" | "match";

const PARTS: { value: Part; label: string; hint: string }[] = [
  { value: "robot", label: "Robot questions", hint: "One shared sheet per team: what you ask them in their pit. Anyone can update it all season." },
  { value: "match", label: "Match report", hint: "Filled in for one of their matches (or as a general note). A team can have any number." },
];

const typeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.type === t)?.label ?? t;

/**
 * Builds a season's scouting form. Keeps the whole form in a hidden input as
 * JSON, so it saves through the page's save bar like any other box.
 */
export function FormBuilder({
  saved,
  starter,
  previous,
}: {
  saved: ScoutingForm;
  starter: ScoutingForm;
  /** Last season's form, to copy from. */
  previous: { year: number; form: ScoutingForm } | null;
}) {
  const [form, setForm] = useState<ScoutingForm>(saved);
  const [part, setPart] = useState<Part>("robot");
  const confirm = useConfirm();
  const fields = form[part];
  const empty = form.robot.length === 0 && form.match.length === 0;

  function update(next: ScoutingField[]) {
    setForm((f) => ({ ...f, [part]: next }));
  }
  function change(i: number, patch: Partial<ScoutingField>) {
    update(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }
  function add(type: FieldType) {
    const label = type === "section" ? "New heading" : "New question";
    const field: ScoutingField = { id: newFieldId(label), type, label };
    if (type === "choice" || type === "multi") field.options = ["Option 1", "Option 2"];
    update([...fields, field]);
  }
  async function replaceWith(next: ScoutingForm, what: string) {
    if (!empty) {
      const ok = await confirm({
        title: `Replace the form?`,
        message: `This swaps every question for ${what}. Nothing is saved until you click Save changes, and answers people already gave are kept.`,
        confirmLabel: "Replace",
      });
      if (!ok) return;
    }
    // New ids, so this season's answers are its own.
    const fresh = (list: ScoutingField[]) => list.map((f) => ({ ...f, id: newFieldId(f.label) }));
    setForm({ robot: fresh(next.robot), match: fresh(next.match) });
  }

  return (
    <div className="flex flex-col gap-5">
      <input type="hidden" name="fields" value={JSON.stringify(form)} data-default={JSON.stringify(saved)} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => replaceWith(starter, "the example form")} className={smallButton}>
          {empty ? "Start from the example form" : "Reset to the example form"}
        </button>
        {previous && (
          <button type="button" onClick={() => replaceWith(previous.form, `the ${previous.year} form`)} className={smallButton}>
            Copy the {previous.year} form
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Form part" className="flex gap-1 rounded-md border border-line bg-ink p-1 sm:self-start">
        {PARTS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={part === p.value}
            onClick={() => setPart(p.value)}
            className={`flex h-9 grow items-center justify-center gap-2 rounded px-4 text-sm font-semibold sm:grow-0 ${
              part === p.value ? "bg-bone text-ink" : "text-sand hover:text-bone"
            }`}
          >
            {p.label}
            <span className={`font-label text-xs ${part === p.value ? "text-ink/60" : "text-ash"}`}>
              {form[p.value].filter((f) => f.type !== "section").length}
            </span>
          </button>
        ))}
      </div>
      <p className="-mt-2 text-sm text-dust">{PARTS.find((p) => p.value === part)!.hint}</p>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-6 text-center text-sm text-dust">No questions yet. Add some below, or start from the example form.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <FieldRow
              key={f.id}
              field={f}
              first={i === 0}
              last={i === fields.length - 1}
              onChange={(patch) => change(i, patch)}
              onMove={(by) => move(i, by)}
              onRemove={async () => {
                const ok = await confirm({
                  title: `Remove "${f.label}"?`,
                  message: "Answers people already gave are kept, and come back if you add the question again. Nothing is saved until you click Save changes.",
                  confirmLabel: "Remove",
                  danger: true,
                });
                if (ok) update(fields.filter((_, j) => j !== i));
              }}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-edge p-3">
        <span className="text-sm font-semibold">Add to the {part === "robot" ? "robot questions" : "match report"}</span>
        <div className="flex flex-wrap gap-2">
          {FIELD_TYPES.map((t) => (
            <button key={t.type} type="button" onClick={() => add(t.type)} title={t.hint} className={smallButton}>
              + {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const smallButton =
  "flex h-9 items-center rounded-md border border-line-strong px-3 text-sm font-semibold text-bone hover:border-bone disabled:opacity-40";

function FieldRow({
  field: f,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  field: ScoutingField;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<ScoutingField>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const [newOption, setNewOption] = useState("");
  const heading = f.type === "section";
  const addOption = () => {
    const v = newOption.trim();
    if (!v || f.options?.includes(v)) return;
    onChange({ options: [...(f.options ?? []), v] });
    setNewOption("");
  };

  return (
    <li className={`flex flex-col gap-3 rounded-md border p-3 ${heading ? "border-line-strong bg-raise" : "border-line bg-ink"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 shrink-0 rounded bg-panel px-2 py-1 text-center font-label text-[10px] font-bold tracking-wide text-dust uppercase">
          {typeLabel(f.type)}
        </span>
        <input
          value={f.label}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label="Question"
          placeholder={heading ? "Heading" : "Question"}
          className={`${inputClass.replace("w-full", "w-auto")} h-10 min-w-48 grow basis-60 ${heading ? "font-display text-lg font-bold uppercase" : ""}`}
        />
        {f.type === "number" && (
          <input
            value={f.unit ?? ""}
            onChange={(e) => onChange({ unit: e.target.value })}
            aria-label="Unit"
            placeholder="Unit (lb, in…)"
            className={`${inputClass.replace("w-full", "w-32")} h-10`}
          />
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={first} aria-label={`Move "${f.label}" up`} className={iconButton}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={last} aria-label={`Move "${f.label}" down`} className={iconButton}>
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove "${f.label}"`}
            className="flex h-9 items-center rounded-md px-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            Remove
          </button>
        </div>
      </div>

      {(f.type === "choice" || f.type === "multi") && (
        <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-26">
          {(f.options ?? []).map((o) => (
            <span key={o} className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong pr-1 pl-3 text-sm">
              {o}
              <button
                type="button"
                onClick={() => onChange({ options: f.options?.filter((x) => x !== o) })}
                aria-label={`Remove option ${o}`}
                className="flex size-6 items-center justify-center rounded-full text-dust hover:bg-raise hover:text-bone"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOption();
              }
            }}
            placeholder="Add an option"
            aria-label={`Add an option to "${f.label}"`}
            className={`${inputClass.replace("w-full", "w-40")} h-8 text-sm`}
          />
          <button type="button" onClick={addOption} className="h-8 px-2 text-sm font-semibold text-hornet hover:text-hornet-hover">
            Add
          </button>
        </div>
      )}

      {!heading && (
        <input
          value={f.help ?? ""}
          onChange={(e) => onChange({ help: e.target.value })}
          aria-label={`Hint for "${f.label}"`}
          placeholder="Optional hint shown under the question"
          className={`${inputClass} h-9 text-sm sm:ml-26 sm:w-[calc(100%-6.5rem)]`}
        />
      )}
    </li>
  );
}

const iconButton =
  "flex size-9 items-center justify-center rounded-md border border-line-strong text-sand hover:border-bone hover:text-bone disabled:opacity-30";
