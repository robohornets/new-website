// Worker settings that `wrangler types` can't see because they aren't in wrangler.jsonc.
interface CloudflareEnv {
  /** The Blue Alliance read API key. Set with `npx wrangler secret put TBA_API_KEY`. */
  TBA_API_KEY?: string;
  /** Only for local testing against a fake TBA server. */
  TBA_BASE_URL?: string;
}
