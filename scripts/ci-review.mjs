#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const review = resolve(import.meta.dirname, "review-project.mjs");
const result = spawnSync(process.execPath, [review, ...process.argv.slice(2), "--ci", "--format", "json"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
