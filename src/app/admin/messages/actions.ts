"use server";

import { adminAction, type ActionState } from "@/lib/admin";
import { run } from "@/lib/db";

export async function setRead(id: number, read: boolean, _prev: ActionState): Promise<ActionState> {
  return adminAction(null, async () => {
    await run(
      `UPDATE messages SET read_at = ${read ? "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')" : "NULL"} WHERE id = ?`,
      id,
    );
    return read ? "Marked read." : "Marked unread.";
  });
}

export async function setArchived(id: number, archived: boolean, _prev: ActionState): Promise<ActionState> {
  return adminAction(null, async () => {
    await run(
      "UPDATE messages SET archived = ?, read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) WHERE id = ?",
      archived ? 1 : 0,
      id,
    );
    return archived ? "Archived." : "Moved to inbox.";
  });
}

export async function deleteMessage(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "message", entityId: id }, async () => {
    await run("DELETE FROM messages WHERE id = ?", id);
    return "Deleted.";
  });
}
