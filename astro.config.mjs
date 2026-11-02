import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Static output only. Set SITE_URL (for example https://your-domain.com) at build time once the
// production domain is known; it switches on canonical and Open Graph URLs. No domain is invented.
export default defineConfig({
  output: "static",
  site: process.env.SITE_URL,
  vite: { plugins: [tailwindcss()] },
});
