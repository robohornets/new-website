"use server";

import { headers } from "next/headers";
import { first, run } from "@/lib/db";
import { MESSAGE_TOPICS, type MessageTopic } from "@/lib/types";

export type ContactState = { ok: boolean; error?: string; fieldErrors?: Partial<Record<"name" | "email" | "body", string>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_HOUR = 5;

async function hashIp(ip: string) {
  const data = new TextEncoder().encode(`btwrobotics:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Bots fill in the hidden "website" field; pretend it worked.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  const topicRaw = String(formData.get("topic") ?? "other");
  const topic: MessageTopic = MESSAGE_TOPICS.some((t) => t.value === topicRaw) ? (topicRaw as MessageTopic) : "other";

  const fieldErrors: ContactState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Please tell us your name.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Please enter an email address we can reply to.";
  if (body.length < 10) fieldErrors.body = "Please write a little more so we know how to help.";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = await hashIp(ip);

  const recent = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')`,
    ipHash,
  );
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
    return { ok: false, error: "You've sent a few messages already. Please try again in an hour, or email us directly." };
  }

  await run(
    "INSERT INTO messages (name, email, topic, body, ip_hash) VALUES (?, ?, ?, ?, ?)",
    name,
    email,
    topic,
    body,
    ipHash,
  );
  return { ok: true };
}
