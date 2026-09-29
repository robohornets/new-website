"use server";

import { redirect } from "next/navigation";
import { adminAction, FormError, optionalInt, str, type ActionState } from "@/lib/admin";
import { batch, first, run } from "@/lib/db";
import { getCurrentSeason } from "@/lib/data";

type Request = { id: number; first_name: string; last_name: string; graduation_year: number; status: string };

/** Puts the student on the current season's roster with the subteam the admin picked. */
export async function addJoinToRoster(requestId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await adminAction({ action: "add_to_roster", entity: "join_request", entityId: requestId }, async (user) => {
    const request = await first<Request>(
      "SELECT id, first_name, last_name, graduation_year, status FROM join_requests WHERE id = ?",
      requestId,
    );
    if (!request) throw new FormError("That request doesn't exist anymore.");
    if (request.status === "added") throw new FormError("They're already on the roster.");
    const season = await getCurrentSeason();
    if (!season) throw new FormError("Create a season first (Seasons, robots & events).");
    const subteamId = optionalInt(fd, "subteam_id");
    const role = str(fd, "role", 80) || "Member";

    // Someone coming back (same name and class) keeps their existing profile.
    let person = await first<{ id: number }>(
      `SELECT id FROM people WHERE kind = 'student' AND first_name = ? COLLATE NOCASE AND last_name = ? COLLATE NOCASE
         AND graduation_year = ? ORDER BY id LIMIT 1`,
      request.first_name,
      request.last_name,
      request.graduation_year,
    );
    if (person && (await first("SELECT 1 FROM roster_entries WHERE person_id = ? AND season_year = ?", person.id, season.year))) {
      throw new FormError(`${request.first_name} ${request.last_name} is already on the ${season.year} roster. Decline this request instead.`);
    }
    if (!person) {
      person = await first<{ id: number }>(
        "INSERT INTO people (first_name, last_name, kind, graduation_year) VALUES (?, ?, 'student', ?) RETURNING id",
        request.first_name,
        request.last_name,
        request.graduation_year,
      );
      if (!person) throw new Error("insert failed");
    }
    await batch([
      [
        "INSERT INTO roster_entries (season_year, person_id, role, subteam_id, is_leadership, sort_order) VALUES (?, ?, ?, ?, 0, 0)",
        season.year,
        person.id,
        role,
        subteamId,
      ],
      [
        `UPDATE join_requests SET status = 'added', assigned_subteam_id = ?, person_id = ?, season_year = ?, decided_by = ?,
           decided_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
        subteamId,
        person.id,
        season.year,
        user.email,
        requestId,
      ],
    ]);
    return `${request.first_name} is on the ${season.year} roster.`;
  });
  // The card leaves the Pending list, so say what happened at the top instead.
  if (result.ok) redirect(`/admin/join?done=added&id=${requestId}`);
  return result;
}

export async function declineJoin(requestId: number, _prev: ActionState): Promise<ActionState> {
  const result = await adminAction({ action: "decline", entity: "join_request", entityId: requestId }, async (user) => {
    await run(
      `UPDATE join_requests SET status = 'declined', decided_by = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ? AND status = 'pending'`,
      user.email,
      requestId,
    );
  });
  if (result.ok) redirect(`/admin/join?done=declined&id=${requestId}`);
  return result;
}

/** Moves a declined request back to Pending. */
export async function reopenJoin(requestId: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "reopen", entity: "join_request", entityId: requestId }, async () => {
    await run("UPDATE join_requests SET status = 'pending', decided_by = NULL, decided_at = NULL WHERE id = ? AND status = 'declined'", requestId);
    return "Moved back to Pending.";
  });
}

export async function deleteJoin(requestId: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "join_request", entityId: requestId }, async () => {
    await run("DELETE FROM join_requests WHERE id = ?", requestId);
    return "Deleted.";
  });
}

/** Empties the Added or Declined tab. People already added stay on the roster. */
export async function clearJoinTab(status: "added" | "declined", _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "clear", entity: "join_requests", entityId: status }, async () => {
    await run("DELETE FROM join_requests WHERE status = ?", status);
    return "Cleared.";
  });
}
