import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;

// Gives `next dev` local D1 and R2 bindings from wrangler.jsonc.
initOpenNextCloudflareForDev();
