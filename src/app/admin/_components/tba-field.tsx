import { inputClass } from "./fields";

type Value = string | number | null | undefined;

/**
 * One field that can come from The Blue Alliance. Shows what the site
 * displays (editable), what TBA says, and whether an admin has overridden it.
 * Put inside the form of the Server Action that saves the record; `reset` is
 * a Server Action bound to this field, run by the Reset button.
 */
export function TbaField({
  name,
  label,
  type = "text",
  value,
  tbaValue,
  synced,
  overridden,
  reset,
  hint,
  options,
}: {
  name: string;
  label: string;
  type?: "text" | "date" | "url" | "number";
  value: Value;
  tbaValue: Value;
  /** Whether this record has ever come from TBA. */
  synced: boolean;
  overridden: boolean;
  reset: () => Promise<void>;
  hint?: string;
  options?: { value: string; label: string }[];
}) {
  const shown = value ?? "";
  const fromTba = tbaValue === null || tbaValue === undefined || tbaValue === "" ? "(nothing yet)" : String(tbaValue);
  return (
    <div className={`flex flex-col gap-1.5 rounded-md p-3 ${overridden ? "border border-amber/50 bg-amber-bg/40" : "border border-transparent"}`}>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        <span className="flex flex-wrap items-center gap-2">
          {label}
          {overridden && (
            <span className="rounded bg-amber px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-ink">EDITED</span>
          )}
        </span>
        {options ? (
          <select name={name} defaultValue={String(shown)} className={inputClass}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input name={name} type={type} defaultValue={String(shown)} className={inputClass} />
        )}
      </label>
      {/* What the form showed, so only fields the admin actually changed become overrides. */}
      <input type="hidden" name={`shown_${name}`} value={String(shown)} />
      {synced && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-dust">
            The Blue Alliance says: <span className="font-mono text-sand">{fromTba}</span>
          </span>
          {overridden && (
            <button type="submit" formAction={reset} formNoValidate className="font-semibold text-hornet underline-offset-2 hover:text-amber hover:underline">
              Reset to TBA
            </button>
          )}
        </div>
      )}
      {overridden && <span className="text-xs text-amber">The site shows your value. Syncing won&apos;t change it.</span>}
      {hint && <span className="text-xs text-dust">{hint}</span>}
    </div>
  );
}
