"use server";

import { adminAction, str, type ActionState } from "@/lib/admin";
import { getEnv } from "@/lib/cf";
import { first, run } from "@/lib/db";

export async function updateMediaAlt(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction(null, async () => {
    await run("UPDATE media SET alt = ? WHERE id = ?", str(fd, "alt", 300), id);
  });
}

export async function deleteMedia(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "media", entityId: id }, async () => {
    const row = await first<{ r2_key: string }>("SELECT r2_key FROM media WHERE id = ?", id);
    if (!row) return "Already deleted.";
    // Rows that pointed at this file fall back to no image (ON DELETE SET NULL).
    await run("DELETE FROM media WHERE id = ?", id);
    await (await getEnv()).MEDIA.delete(row.r2_key);
    return "Deleted.";
  });
}
