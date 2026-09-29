import "server-only";
import { headers } from "next/headers";

/** A one-way hash of the visitor's IP, only for rate limiting public forms. */
export async function visitorIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const data = new TextEncoder().encode(`btwrobotics:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
