import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { connection } from "next/server";

/**
 * Worker bindings (D1, R2, vars). Awaiting `connection()` first keeps every
 * page that touches the database rendered per request, so admin edits show
 * up immediately without an ISR cache.
 */
export async function getEnv(): Promise<CloudflareEnv> {
  await connection();
  const { env } = await getCloudflareContext({ async: true });
  return env;
}
