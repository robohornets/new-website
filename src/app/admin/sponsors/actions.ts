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

/** The sponsor's details, and (when a season is picked) their tier that season. */
export async function updateSponsor(id: number, year: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "sponsor", entityId: id }, async () => {
    const statements: [string, ...(string | number | null)[]][] = [
      ["UPDATE sponsors SET name = ?, url = ?, description = ?, logo_media_id = ? WHERE id = ?", ...sponsorFields(fd), id],
    ];
    // No tier box without a season or tiers; leave their seasons alone then.
    if (year && fd.has("tier_id")) {
      const tier = optionalInt(fd, "tier_id");
      if (tier) {
        const exists = await first("SELECT 1 FROM sponsor_tiers WHERE id = ?", tier);
        if (!exists) throw new FormError("That tier no longer exists. Reload the page and pick again.");
        statements.push([
          `INSERT INTO sponsor_seasons (sponsor_id, season_year, tier_id, sort_order) VALUES (?, ?, ?, ?)
           ON CONFLICT(sponsor_id, season_year) DO UPDATE SET tier_id = excluded.tier_id, sort_order = excluded.sort_order`,
          id,
          year,
          tier,
          int(fd, "sort_order", 0),
        ]);
      } else {
        statements.push(["DELETE FROM sponsor_seasons WHERE sponsor_id = ? AND season_year = ?", id, year]);
      }
    }
    await batch(statements);
  });
}

export async function deleteSponsor(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "sponsor", entityId: id }, async () => {
    await run("DELETE FROM sponsors WHERE id = ?", id);
    return "Sponsor deleted.";
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
