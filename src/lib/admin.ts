import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin, UnauthorizedError, type AdminUser } from "./auth";
import { run } from "./db";

export type ActionState = { ok: boolean; message?: string; error?: string; at?: number };

export class FormError extends Error {}

/**
 * Wraps an admin Server Action: checks the Cloudflare Access identity,
 * turns thrown errors into a message for the form, writes an audit entry and
 * refreshes every page so the change shows up straight away.
 */
export async function adminAction(
  audit: { action: string; entity: string; entityId?: string | number | null } | null,
  fn: (user: AdminUser) => Promise<string | void>,
): Promise<ActionState> {
  let user: AdminUser;
  try {
    user = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: e.message, at: Date.now() };
    throw e;
  }
  try {
    const message = await fn(user);
    if (audit) {
      await run(
        "INSERT INTO audit_log (actor, action, entity, entity_id) VALUES (?, ?, ?, ?)",
        user.email,
        audit.action,
        audit.entity,
        audit.entityId == null ? null : String(audit.entityId),
      );
    }
    revalidatePath("/", "layout");
    return { ok: true, message: message || "Saved.", at: Date.now() };
  } catch (e) {
    if (e instanceof FormError) return { ok: false, error: e.message, at: Date.now() };
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE constraint failed/i.test(msg)) {
      return { ok: false, error: "Something with that name or URL already exists.", at: Date.now() };
    }
    console.error("admin action failed", e);
    return { ok: false, error: "That didn't save. Please try again.", at: Date.now() };
  }
}

// ---- FormData helpers -------------------------------------------------------

export function str(fd: FormData, key: string, max = 2000): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export function required(fd: FormData, key: string, label: string, max = 2000): string {
  const v = str(fd, key, max);
  if (!v) throw new FormError(`${label} is required.`);
  return v;
}

export function optional(fd: FormData, key: string, max = 2000): string | null {
  return str(fd, key, max) || null;
}

export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function optionalInt(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function bool(fd: FormData, key: string): 0 | 1 {
  const v = fd.get(key);
  return v === "on" || v === "1" || v === "true" ? 1 : 0;
}

export function url(fd: FormData, key: string): string | null {
  const v = str(fd, key, 500);
  if (!v) return null;
  const withScheme = /^[a-z]+:\/\//i.test(v) || v.startsWith("/") || v.startsWith("mailto:") ? v : `https://${v}`;
  if (!/^(https?:\/\/|\/|mailto:)/i.test(withScheme)) throw new FormError(`"${v}" isn't a web link.`);
  return withScheme;
}

export function date(fd: FormData, key: string): string | null {
  const v = str(fd, key, 40);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) throw new FormError("Dates need to look like 2027-01-09.");
  return v;
}

export function oneOf<T extends string>(fd: FormData, key: string, options: readonly T[], fallback: T): T {
  const v = str(fd, key);
  return (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** "Label: value" per line → [{label, value}] */
export function parseSpecs(text: string): { label: string; value: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i === -1
        ? { label: line, value: "" }
        : { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    })
    .filter((s) => s.label);
}

export function specsToText(specs: { label: string; value: string }[]): string {
  return specs.map((s) => (s.value ? `${s.label}: ${s.value}` : s.label)).join("\n");
}

/** "a, b, c" → ["a","b","c"] */
export function parseList(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** "left | right" per line */
export function parsePairs(text: string): [string, string][] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, ...rest] = line.split("|");
      return [a.trim(), rest.join("|").trim()] as [string, string];
    })
    .filter(([a]) => a);
}
