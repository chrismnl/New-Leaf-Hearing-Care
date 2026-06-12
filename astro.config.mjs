import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import { d1, r2 } from "@emdash-cms/cloudflare";

const isCloudflareDeploy = process.env.CF_DEPLOY === "1";

export default defineConfig({
  output: "server",
  adapter: isCloudflareDeploy
    ? cloudflare()
    : node({
        mode: "standalone"
      }),
  integrations: [
    react(),
    emdash(
      isCloudflareDeploy
        ? {
            database: d1({ binding: "DB" }),
            storage: r2({ binding: "MEDIA" }),
            mcp: true
          }
        : {
            database: sqlite({ url: "file:./data/emdash.db" }),
            storage: local({
              directory: "./uploads",
              baseUrl: "/_emdash/api/media/file"
            }),
            mcp: true
          }
    )
  ]
});
