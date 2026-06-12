import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["astro", "build"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    CF_DEPLOY: "1"
  }
});

process.exit(result.status ?? 1);
