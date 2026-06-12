import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];

if (target !== "staging" && target !== "production") {
  console.error("Usage: node scripts/deploy-cloudflare.mjs <staging|production>");
  process.exit(1);
}

const build = spawnSync("npx", ["astro", "build"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    CF_DEPLOY: "1"
  }
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (target === "staging") {
  const wrangler = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
  const generatedPath = "dist/server/wrangler.json";
  const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
  const staging = wrangler.env?.staging;

  if (!staging) {
    console.error("Missing wrangler env.staging configuration.");
    process.exit(1);
  }

  generated.name = staging.name;
  generated.topLevelName = staging.name;
  generated.workers_dev = staging.workers_dev ?? generated.workers_dev;
  generated.d1_databases = staging.d1_databases ?? generated.d1_databases;
  generated.r2_buckets = staging.r2_buckets ?? generated.r2_buckets;
  generated.kv_namespaces = staging.kv_namespaces ?? generated.kv_namespaces;

  writeFileSync(generatedPath, JSON.stringify(generated, null, 2));
}

const wranglerArgs = target === "staging"
  ? ["wrangler", "deploy"]
  : ["wrangler", "deploy"];

const deploy = spawnSync("npx", wranglerArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    CF_DEPLOY: "1"
  }
});

process.exit(deploy.status ?? 1);
