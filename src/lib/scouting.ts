// Scouting form definitions and the rules for the answers people save.
// Shared by the admin form builder, the public /scouting app and the API,
// so it has no server-only imports.

export const FIELD_TYPES = [
  { type: "section", label: "Heading", hint: "Splits the form into parts, like Autonomous or Endgame." },
  { type: "counter", label: "Counter", hint: "A number with big − and + buttons, for counting during a match." },
  { type: "toggle", label: "Yes / no", hint: "One tap: did they do it?" },
  { type: "choice", label: "Pick one", hint: "Buttons for one answer, e.g. drivetrain type." },
  { type: "multi", label: "Pick any", hint: "Tick as many as apply, e.g. where they can score." },
  { type: "rating", label: "Rating 1–5", hint: "Stars for things like driver skill." },
  { type: "number", label: "Number", hint: "Typed number with a unit, e.g. weight in lb." },
  { type: "text", label: "Short text", hint: "One line." },
  { type: "longtext", label: "Notes", hint: "A big box for anything else." },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["type"];

export type ScoutingField = {
  /** Stable key the answers are saved under. Never changes, even if the label does. */
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  /** choice / multi */
  options?: string[];
  /** number */
  unit?: string;
};

/** A season's form: questions about the robot, and questions for each match report. */
export type ScoutingForm = { robot: ScoutingField[]; match: ScoutingField[] };

export type ScoutingValue = number | boolean | string | string[];
export type ScoutingData = Record<string, ScoutingValue>;

export const EMPTY_FORM: ScoutingForm = { robot: [], match: [] };

const TYPES = new Set<string>(FIELD_TYPES.map((t) => t.type));

export function newFieldId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return `${slug || "field"}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Cleans a form coming from the admin: known types, trimmed text, unique ids. */
export function cleanForm(raw: unknown): ScoutingForm {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const part = (list: unknown): ScoutingField[] =>
    (Array.isArray(list) ? list : [])
      .map((f): ScoutingField | null => {
        if (!f || typeof f !== "object") return null;
        const o = f as Record<string, unknown>;
        const type = String(o.type ?? "");
        const label = String(o.label ?? "").trim().slice(0, 120);
        let id = String(o.id ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 40);
        if (!TYPES.has(type) || !label) return null;
        if (!id || seen.has(id)) id = newFieldId(label);
        seen.add(id);
        const field: ScoutingField = { id, type: type as FieldType, label };
        const help = String(o.help ?? "").trim().slice(0, 200);
        if (help) field.help = help;
        if (type === "choice" || type === "multi") {
          field.options = [
            ...new Set(
              (Array.isArray(o.options) ? o.options : [])
                .map((x) => String(x).trim().slice(0, 60))
                .filter(Boolean),
            ),
          ].slice(0, 20);
        }
        if (type === "number") {
          const unit = String(o.unit ?? "").trim().slice(0, 12);
          if (unit) field.unit = unit;
        }
        return field;
      })
      .filter((f): f is ScoutingField => f !== null)
      .slice(0, 80);
  return { robot: part(input.robot), match: part(input.match) };
}

/**
 * Keeps only answers that fit the form: numbers for counters, one of the
 * options for "pick one", and so on. Answers to questions that were removed
 * from the form are kept (from `previous`), so adding a question back brings
 * its answers back too.
 */
export function cleanData(fields: ScoutingField[], raw: unknown, previous: ScoutingData = {}): ScoutingData {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const known = new Set(fields.map((f) => f.id));
  const out: ScoutingData = {};
  for (const [k, v] of Object.entries(previous)) if (!known.has(k)) out[k] = v;
  for (const f of fields) {
    const v = input[f.id];
    if (v === undefined || v === null || v === "") continue;
    switch (f.type) {
      case "section":
        break;
      case "counter": {
        const n = Math.round(Number(v));
        if (Number.isFinite(n)) out[f.id] = Math.min(Math.max(n, 0), 999);
        break;
      }
      case "number": {
        const n = Number(v);
        if (Number.isFinite(n)) out[f.id] = Math.min(Math.max(n, -99999), 99999);
        break;
      }
      case "rating": {
        const n = Math.round(Number(v));
        if (n >= 1 && n <= 5) out[f.id] = n;
        break;
      }
      case "toggle":
        out[f.id] = v === true || v === "true" || v === "on";
        break;
      case "choice": {
        const s = String(v);
        if (f.options?.includes(s)) out[f.id] = s;
        break;
      }
      case "multi": {
        const list = (Array.isArray(v) ? v : [v]).map(String).filter((s) => f.options?.includes(s));
        if (list.length) out[f.id] = [...new Set(list)];
        break;
      }
      case "text":
        out[f.id] = String(v).trim().slice(0, 200);
        break;
      case "longtext":
        out[f.id] = String(v).trim().slice(0, 3000);
        break;
    }
    if (out[f.id] === "") delete out[f.id];
  }
  return out;
}

/** "qm12" → "Qual 12", "sf2m1" → "Semifinal 2-1", from a TBA match key. */
export function matchKeyLabel(matchKey: string | null | undefined): string {
  if (!matchKey) return "General note";
  const part = matchKey.split("_")[1] ?? matchKey;
  const m = /^(qm|ef|qf|sf|f)(\d+)(?:m(\d+))?$/.exec(part);
  if (!m) return part;
  const [, level, set, match] = m;
  const name = { qm: "Qual", ef: "Octofinal", qf: "Quarterfinal", sf: "Semifinal", f: "Final" }[level] ?? level;
  if (level === "qm") return `${name} ${set}`;
  return match ? `${name} ${set}-${match}` : `${name} ${set}`;
}

export const EVENT_KEY_RE = /^\d{4}[a-z0-9]{1,16}$/;
export const MATCH_KEY_RE = /^\d{4}[a-z0-9]{1,16}_(qm|ef|qf|sf|f)\d{1,3}(m\d{1,2})?$/;

let n = 0;
const f = (type: FieldType, label: string, extra: Partial<ScoutingField> = {}): ScoutingField => ({
  id: `starter_${++n}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20)}`,
  type,
  label,
  ...extra,
});

/**
 * A starting point for a new season, based on what most FRC teams track.
 * The game-specific parts (what they score, how the endgame works) need
 * editing after kickoff.
 */
export const STARTER_FORM: ScoutingForm = {
  robot: [
    f("section", "Robot"),
    f("choice", "Drivetrain", { options: ["Swerve", "Tank / West Coast", "Mecanum", "Other"] }),
    f("number", "Weight", { unit: "lb", help: "Without bumpers and battery, if they know." }),
    f("choice", "Programming language", { options: ["Java", "C++", "Python", "LabVIEW", "Other"] }),
    f("multi", "Can score in", { options: ["Low", "Middle", "High"], help: "Change these to this year's scoring spots." }),
    f("choice", "Endgame", { options: ["None", "Park", "Low climb", "High climb"], help: "Change these to this year's endgame." }),
    f("section", "Autonomous"),
    f("toggle", "Has an autonomous routine"),
    f("multi", "Can start from", { options: ["Left", "Center", "Right"] }),
    f("longtext", "Auto routines", { help: "What their autos do, and how reliable they say they are." }),
    f("section", "Team"),
    f("choice", "Drive team experience", { options: ["First year", "1–2 years", "3+ years"] }),
    f("longtext", "Strengths"),
    f("longtext", "Concerns", { help: "Anything that breaks, reliability, missing pieces." }),
  ],
  match: [
    f("section", "Autonomous"),
    f("toggle", "Left the starting zone"),
    f("counter", "Auto game pieces scored"),
    f("section", "Teleop"),
    f("counter", "Game pieces scored"),
    f("counter", "Missed shots"),
    f("toggle", "Played defense"),
    f("section", "Endgame"),
    f("choice", "Endgame result", { options: ["Nothing", "Parked", "Climbed", "Tried, failed"] }),
    f("section", "Overall"),
    f("rating", "Driver skill"),
    f("toggle", "Broke down or was disabled"),
    f("counter", "Fouls"),
    f("longtext", "Notes"),
  ],
};

/**
 * A summary of one question across many match reports: the average for
 * numbers and ratings, how often for yes/no, the most common answer
 * otherwise. Text questions have no summary.
 */
export function summarize(field: ScoutingField, values: ScoutingValue[]): string | null {
  if (values.length === 0) return null;
  switch (field.type) {
    case "counter":
    case "number":
    case "rating": {
      const nums = values.map(Number).filter(Number.isFinite);
      if (!nums.length) return null;
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const max = Math.max(...nums);
      return `avg ${avg.toFixed(1)}${field.type === "rating" ? " / 5" : ""} · max ${max}`;
    }
    case "toggle": {
      const yes = values.filter((v) => v === true).length;
      return `${yes} of ${values.length}`;
    }
    case "choice":
    case "multi": {
      const counts = new Map<string, number>();
      for (const v of values) for (const s of Array.isArray(v) ? v : [String(v)]) counts.set(s, (counts.get(s) ?? 0) + 1);
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s, c]) => `${s} ×${c}`)
        .join(", ");
    }
    default:
      return null;
  }
}
