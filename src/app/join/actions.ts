"use server";

import { revalidatePath } from "next/cache";
import { all, first, run } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { visitorIpHash } from "@/lib/ip";
import { JOIN_ABOUT_MAX, joinGraduationYears } from "@/lib/join";

export type JoinState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"first_name" | "last_name" | "graduation_year" | "about", string>>;
  /** What they typed, so the form can fill back in after an error. */
  values?: { first_name: string; last_name: string; graduation_year: string };
};

// Generous, because a whole interest meeting can submit from one school network.
const MAX_PER_HOUR = 60;

export async function submitJoinRequest(_prev: JoinState, fd: FormData): Promise<JoinState> {
  // Bots fill in the hidden "website" field; pretend it worked.
  if (String(fd.get("website") ?? "").trim()) return { ok: true };

  const settings = await getSettings();
  if (!settings.join_requests.open) return { ok: false, error: "Join requests just closed. Ask a team leader when they open again." };

  const firstName = String(fd.get("first_name") ?? "").trim().slice(0, 60);
  const lastName = String(fd.get("last_name") ?? "").trim().slice(0, 60);
  const grad = Number(fd.get("graduation_year"));
  const about = String(fd.get("about") ?? "").trim();

  const values = { first_name: firstName, last_name: lastName, graduation_year: String(fd.get("graduation_year") ?? "") };
  const fieldErrors: JoinState["fieldErrors"] = {};
  if (!firstName) fieldErrors.first_name = "Please enter your first name.";
  if (!lastName) fieldErrors.last_name = "Please enter your last name.";
  if (!joinGraduationYears().includes(grad)) fieldErrors.graduation_year = "Please pick the year you graduate.";
  if (about.length > JOIN_ABOUT_MAX) fieldErrors.about = `Please keep this to ${JOIN_ABOUT_MAX} characters.`;
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values };

  // Only public subteams can be ranked, in the order the student put them.
  const open = await all<{ id: number; name: string }>("SELECT id, name FROM subteams WHERE private = 0");
  const byId = new Map(open.map((s) => [s.id, s]));
  const ranking = [...new Set(fd.getAll("rank").map(Number))].map((id) => byId.get(id)).filter((s) => s !== undefined);
  // Anything they somehow didn't rank goes at the end.
  for (const s of open) if (!ranking.includes(s)) ranking.push(s);

  const ipHash = await visitorIpHash();
  const recent = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM join_requests WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')`,
    ipHash,
  );
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) return { ok: false, error: "Too many requests from this network. Please try again in an hour.", values };

  const saved = [JSON.stringify(ranking), about, ranking[0]?.id ?? null] as const;
  // Sending it again replaces their pending request instead of adding a second one.
  const existing = await first<{ id: number }>(
    `SELECT id FROM join_requests WHERE status = 'pending' AND first_name = ? COLLATE NOCASE AND last_name = ? COLLATE NOCASE AND graduation_year = ?`,
    firstName,
    lastName,
    grad,
  );
  if (existing) {
    await run("UPDATE join_requests SET ranking = ?, about = ?, assigned_subteam_id = ? WHERE id = ?", ...saved, existing.id);
  } else {
    await run(
      `INSERT INTO join_requests (first_name, last_name, graduation_year, ranking, about, assigned_subteam_id, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      firstName,
      lastName,
      grad,
      ...saved,
      ipHash,
    );
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}
