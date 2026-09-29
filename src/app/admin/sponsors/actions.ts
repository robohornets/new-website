"use server";

import { adminAction, FormError, int, optionalInt, str, url, type ActionState } from "@/lib/admin";
import { batch, first, run } from "@/lib/db";

function sponsorFields(fd: FormData) {
  const name = str(fd, "name", 160);
  if (!name) throw new FormError("Sponsor name is required.");
  return [name, url(fd, "url"), str(fd, "description", 600), optionalInt(fd, "logo_media_id")] as const;
}

export async function createSponsor(year: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "sponsor", entityId: str(fd, "name") }, async () => {
    const row = await first<{ id: number }>(
      "INSERT INTO sponsors (name, url, description, logo_media_id) VALUES (?, ?, ?, ?) RETURNING id",
      ...sponsorFields(fd),
    );
    const tierId = optionalInt(fd, "tier_id");
    if (row && year && tierId) {
      await run("INSERT INTO sponsor_seasons (sponsor_id, season_year, tier_id) VALUES (?, ?, ?)", row.id, year, tierId);
    }
    return "Sponsor added.";
  });
}

export async function updateSponsor(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "sponsor", entityId: id }, async () => {
    await run("UPDATE sponsors SET name = ?, url = ?, description = ?, logo_media_id = ? WHERE id = ?", ...sponsorFields(fd), id);
  });
}

export async function deleteSponsor(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "sponsor", entityId: id }, async () => {
    await run("DELETE FROM sponsors WHERE id = ?", id);
    return "Sponsor deleted.";
  });
}

/** Replaces which sponsors (and tiers) are listed for a season. */
export async function saveLineup(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "lineup", entity: "sponsor_seasons", entityId: year }, async () => {
    const ids = str(fd, "ids", 10_000)
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    const statements: [string, ...(string | number | null)[]][] = [["DELETE FROM sponsor_seasons WHERE season_year = ?", year]];
    for (const id of ids) {
      const tier = int(fd, `tier_${id}`, 0);
      if (tier > 0) {
        statements.push([
          "INSERT INTO sponsor_seasons (sponsor_id, season_year, tier_id, sort_order) VALUES (?, ?, ?, ?)",
          id,
          year,
          tier,
          int(fd, `order_${id}`, 0),
        ]);
      }
    }
    await batch(statements);
    return `${year} sponsors saved.`;
  });
}

export async function createTier(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "sponsor_tier", entityId: str(fd, "name") }, async () => {
    const name = str(fd, "name", 60);
    if (!name) throw new FormError("Tier name is required.");
    await run("INSERT INTO sponsor_tiers (name, rank) VALUES (?, ?)", name, int(fd, "rank", 10));
    return "Tier added.";
  });
}

export async function updateTier(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "sponsor_tier", entityId: id }, async () => {
    const name = str(fd, "name", 60);
    if (!name) throw new FormError("Tier name is required.");
    await run("UPDATE sponsor_tiers SET name = ?, rank = ? WHERE id = ?", name, int(fd, "rank", 0), id);
  });
}

export async function deleteTier(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "sponsor_tier", entityId: id }, async () => {
    const used = await first("SELECT 1 FROM sponsor_seasons WHERE tier_id = ? LIMIT 1", id);
    if (used) throw new FormError("That tier is still used by a season. Move those sponsors first.");
    await run("DELETE FROM sponsor_tiers WHERE id = ?", id);
    return "Tier deleted.";
  });
}
