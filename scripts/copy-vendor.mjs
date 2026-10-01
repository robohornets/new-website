// Copies browser-only libraries into public/vendor, so the admin can load
// them at run time instead of bundling them. Runs before `next build` and
// `next dev` (see package.json). Bundled, mediabunny (video conversion) would
// also land in the Worker, which never uses it but would load it on start-up.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/mediabunny/dist/bundles/mediabunny.min.mjs", "public/vendor/mediabunny.mjs");
