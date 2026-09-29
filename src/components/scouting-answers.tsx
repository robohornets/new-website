import type { ScoutingData, ScoutingField, ScoutingValue } from "@/lib/scouting";

export function formatAnswer(field: ScoutingField, v: ScoutingValue | undefined): string | null {
  if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  if (field.type === "rating") return `${"★".repeat(Number(v))}${"☆".repeat(5 - Number(v))}`;
  if (field.type === "number" && field.unit) return `${v} ${field.unit}`;
  return String(v);
}

/**
 * Read-only answers in form order, grouped under the form's headings.
 * Unanswered questions are left out; `showEmpty` lists them as "—".
 */
export function ScoutingAnswers({ fields, data, showEmpty = false }: { fields: ScoutingField[]; data: ScoutingData; showEmpty?: boolean }) {
  type Group = { title: string | null; rows: { field: ScoutingField; text: string | null }[] };
  const groups: Group[] = [];
  let current: Group = { title: null, rows: [] };
  for (const f of fields) {
    if (f.type === "section") {
      if (current.rows.length || current.title) groups.push(current);
      current = { title: f.label, rows: [] };
      continue;
    }
    const text = formatAnswer(f, data[f.id]);
    if (text !== null || showEmpty) current.rows.push({ field: f, text });
  }
  groups.push(current);
  const visible = groups.filter((g) => g.rows.length > 0);
  if (visible.length === 0) return <p className="text-sm text-dust">Nothing filled in yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      {visible.map((g, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          {g.title && <h4 className="eyebrow text-[11px] text-ash">{g.title}</h4>}
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[minmax(140px,max-content)_1fr]">
            {g.rows.map(({ field, text }) => (
              <div key={field.id} className="contents">
                <dt className="text-sm text-dust">{field.label}</dt>
                <dd className={`text-[15px] whitespace-pre-line ${text === null ? "text-ash" : ""} ${field.type === "rating" ? "text-hornet" : ""}`}>
                  {text ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
