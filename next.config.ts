import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      // The Outreach page is now called Impact.
      { source: "/outreach", destination: "/impact", permanent: true },
      // News was removed; old links land on the homepage instead of a 404.
      // Outreach posts used to live under /news and are now on the Impact page.
      { source: "/news", destination: "/", permanent: true },
      { source: "/news/:slug", destination: "/impact/:slug", permanent: true },
    ];
  },
};

export default nextConfig;

// Gives `next dev` local D1 and R2 bindings from wrangler.jsonc.
initOpenNextCloudflareForDev();
