import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page reads live from D1, so there is no ISR cache to configure.
export default defineCloudflareConfig({});
