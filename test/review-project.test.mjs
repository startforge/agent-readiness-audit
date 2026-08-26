import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fixture = resolve(root, "fixtures/core-permission-pass");
const review = resolve(root, "scripts/review-project.mjs");
const output = execFileSync("node", [review, fixture, "--profiles", "core", "--format", "json"], { encoding: "utf8" });
const report = JSON.parse(output);
const permission = report.findings.find((finding) => finding.id === "T-02");

if (!permission) throw new Error("T-02 finding is missing");
if (permission.status !== "pass") throw new Error(`Expected T-02 pass, got ${permission.status}`);
if (permission.confidence !== "high") throw new Error(`Expected T-02 high confidence, got ${permission.confidence}`);
if (!permission.evidence.some((item) => item.type === "code" && item.line > 0)) throw new Error("T-02 lacks located code evidence");
if (!report.documentation.claims.some((claim) => claim.source === "README.md")) throw new Error("README architecture claim was not indexed");
console.log("review-project fixture test passed");
