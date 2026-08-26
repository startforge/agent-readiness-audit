import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { STANDARDS } from "../lib/standards.mjs";
import { VERSION } from "../lib/constants.mjs";

const root = resolve(import.meta.dirname, "..");
const fixturesRoot = join(root, "fixtures");
const review = join(root, "scripts/review-project.mjs");

function reviewFixture(name) {
  const started = Date.now();
  const target = join(fixturesRoot, name);
  const output = execFileSync("node", [review, target, "--profiles", "core", "--format", "json"], {
    encoding: "utf8",
  });
  return { report: JSON.parse(output), durationMs: Date.now() - started };
}

function assertFinding(report, id, expected) {
  const finding = report.findings.find((item) => item.id === id);
  if (!finding) throw new Error(`${id} finding is missing`);
  if (finding.status !== expected.status) {
    throw new Error(`${id}: expected ${expected.status}, got ${finding.status}`);
  }
  if (expected.requireLocatedCode) {
    if (!finding.evidence.some((item) => item.type === "code" && item.line > 0 && item.file && item.snippet)) {
      throw new Error(`${id} lacks located code evidence (file, line, snippet)`);
    }
  }
  if (expected.requireReadmeClaim) {
    if (!report.documentation.claims.some((claim) => claim.source === "README.md")) {
      throw new Error("README architecture claim was not indexed");
    }
  }
}

const fixtureDirs = readdirSync(fixturesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!fixtureDirs.length) throw new Error("No fixtures found");

const started = Date.now();
const results = [];
for (const name of fixtureDirs) {
  const expectedPath = join(fixturesRoot, name, "expected.json");
  if (!existsSync(expectedPath)) throw new Error(`Missing ${name}/expected.json`);
  const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
  const { report, durationMs } = reviewFixture(name);
  for (const [id, spec] of Object.entries(expected)) {
    assertFinding(report, id, spec);
  }
  results.push({ name, durationMs, scannedFiles: report.scannedFiles });
}

const durationMs = Date.now() - started;
const automated = STANDARDS.filter((item) => item.checkStrategy === "automated").length;
const baseline = {
  version: VERSION,
  ruleCount: STANDARDS.length,
  automatedRuleCount: automated,
  standardCoverage: STANDARDS.map((item) => item.id),
  fixtures: results,
  falsePositiveSamples: [
    "comments are ignored as implementation evidence",
    "documentation-only claims cannot pass",
    "unused authorize() cannot pass T-02",
  ],
  falseNegativeSamples: [
    "unused authorize() next to executeTool is treated as a permission bypass",
    "unbounded tool loops without maxSteps fail R-03",
  ],
  durationMs,
  network: false,
};

console.log("fixture suite passed");
console.log(JSON.stringify(baseline, null, 2));
