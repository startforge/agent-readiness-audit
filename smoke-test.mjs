import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname);
const scanner = resolve(root, "scripts/inspect-project.mjs");
const output = execFileSync("node", [scanner, root], { encoding: "utf8" });
const report = JSON.parse(output);
if (report.scannedFiles < 5 || report.codeEvidence["E-01"].length === 0 || report.codeEvidence["O-02"].length === 0) throw new Error("review skill smoke test failed");
console.log("Agent framework review skill smoke test passed");
