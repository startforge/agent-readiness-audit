import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { reviewProject } from "../lib/review.mjs";
import { ciExitCode, compareReports, toSarif } from "../lib/sarif.mjs";
import { stripJsComments, parseModule } from "../lib/ast.mjs";
import { fileCapabilityFlags, detectCapabilities } from "../lib/discovery.mjs";
import { evaluateStandard } from "../lib/engine.mjs";
import { STANDARDS_BY_ID } from "../lib/standards.mjs";
import { detectDeclaredFrameworks, inspectFrameworks } from "../lib/frameworks.mjs";

const root = resolve(import.meta.dirname, "..");
const review = join(root, "scripts/review-project.mjs");

function run(args) {
  return execFileSync("node", [review, ...args], { encoding: "utf8" });
}

const ast = parseModule({
  language: "js",
  relative: "tools.mjs",
  text: "export function executeTool(t) {\n  // authorize(t)\n  return t;\n}\n",
});
if (ast.functions[0].calls.some((call) => call.name === "authorize")) {
  throw new Error("comments must not create call-chain evidence");
}
if (!stripJsComments("a//b\nc").includes("c") || stripJsComments("a// authorize()\n").includes("authorize")) {
  throw new Error("comment stripper failed");
}

if (fileCapabilityFlags({ kind: "test", relative: "e2e/app.spec.ts", text: "import { test } from '@playwright/test'\n" }).hasBrowser) {
  throw new Error("Playwright E2E tests must not enable the browser profile");
}
if (fileCapabilityFlags({ kind: "code", relative: "playwright.config.ts", text: "import { defineConfig } from '@playwright/test'\n" }).hasBrowser) {
  throw new Error("playwright.config must not enable the browser profile");
}
if (!fileCapabilityFlags({ kind: "code", relative: "src/browser.ts", text: "export class BrowserSession {}\n" }).hasBrowser) {
  throw new Error("BrowserSession in production code should enable the browser profile");
}

const likeOnly = detectCapabilities([
  { kind: "code", relative: "src/search.mjs", text: "export function retrieve(q) { return sql`SELECT * FROM docs WHERE title LIKE ${q}` }\n" },
]);
if (!likeOnly.hasRag) throw new Error("LIKE retrieval should still suggest rag");
if (likeOnly.hasEmbeddings) throw new Error("LIKE retrieval should not count as embeddings");
const k02 = evaluateStandard(STANDARDS_BY_ID["K-02"], [], { profiles: ["core", "rag"], capabilities: likeOnly, structure: {} });
if (k02.status !== "not-applicable") throw new Error(`K-02 should be N/A without embeddings, got ${k02.status}`);

const mastraDeclared = detectDeclaredFrameworks("/tmp", [
  { relative: "package.json", text: JSON.stringify({ dependencies: { "@mastra/core": "1.0.0" } }) },
]);
if (!mastraDeclared.some((item) => item.id === "mastra")) throw new Error("package.json should declare Mastra");
const unusedMastra = inspectFrameworks("/tmp", [
  { relative: "package.json", kind: "configuration", text: JSON.stringify({ dependencies: { "@mastra/core": "1.0.0" } }) },
  { relative: "src/app.mjs", kind: "code", language: "js", text: "export const x = 1;\n" },
]);
if (unusedMastra.mode !== "custom") throw new Error("declared Mastra without call sites should fall through to custom scan");

const fail = reviewProject(join(root, "fixtures/core-permission-fail"), { profiles: ["core"] });
if (ciExitCode(fail, { failOn: ["critical"] }) !== 1) throw new Error("CI should block Critical T-02 fail");

const integration = reviewProject(join(root, "fixtures/core-integration-pass"), { profiles: ["core"] });
if (ciExitCode(integration, { failOn: ["critical"] }) !== 0) throw new Error("CI should allow integration fixture without Critical fail");
if (!integration.metrics.latency) throw new Error("integration traces should produce latency metrics");
if (!integration.structure.criticalPath.steps.includes("execution")) throw new Error("critical path should include execution");

const sarif = toSarif(fail);
if (sarif.version !== "2.1.0") throw new Error("SARIF version");
if (!sarif.runs[0].results.some((item) => item.ruleId === "T-02")) throw new Error("SARIF missing T-02");

const pass = reviewProject(join(root, "fixtures/core-permission-pass"), { profiles: ["core"] });
const comparison = compareReports(fail, pass);
if (!comparison.newCriticalFails.some((item) => item.id === "T-02")) throw new Error("compare should flag new Critical T-02 fail");

const dir = mkdtempSync(join(tmpdir(), "review-compare-"));
writeFileSync(join(dir, "prev.json"), JSON.stringify(pass));
const compared = JSON.parse(run([join(root, "fixtures/core-permission-fail"), "--profiles", "core", "--format", "json", "--no-artifacts", "--compare", join(dir, "prev.json")]));
if (!compared.comparison.newCriticalFails.length) throw new Error("CLI --compare did not record new Critical fails");

const executed = reviewProject(join(root, "fixtures/core-permission-pass"), { profiles: ["core"], executeTests: true });
if (!executed.testExecution.executed) throw new Error("execute-tests did not run");

const artifacts = mkdtempSync(join(tmpdir(), "review-artifacts-"));
run([join(root, "fixtures/core-permission-pass"), "--profiles", "core", "--format", "json", "--artifacts-dir", artifacts]);
const receiptPath = join(artifacts, "receipt.json");
const mapHtml = readFileSync(join(artifacts, "map.html"), "utf8");
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
if (receipt.kind !== "agent-framework-review-receipt") throw new Error("receipt kind");
if (!mapHtml.includes("src/tools.mjs")) throw new Error("map.html is missing the file mapping table");
if (!mapHtml.includes("Hierarchy") || !mapHtml.includes("File mapping")) throw new Error("map.html is missing hierarchy or mapping sections");
if (!existsSync(join(artifacts, "map.json")) || !existsSync(join(artifacts, "report.md"))) {
  throw new Error("artifacts dir is missing report or map files");
}
if (!existsSync(join(artifacts, "report.html"))) throw new Error("missing report.html");
const xlsx = readFileSync(join(artifacts, "report.xlsx"));
if (xlsx.subarray(0, 2).toString() !== "PK") throw new Error("report.xlsx is not an Excel workbook");
const reportHtml = readFileSync(join(artifacts, "report.html"), "utf8");
if (!reportHtml.includes("src/tools.mjs") || !reportHtml.includes("Findings")) {
  throw new Error("report.html is missing findings or file mapping");
}

const incremental = JSON.parse(
  run([
    join(root, "fixtures/core-permission-pass"),
    "--profiles",
    "core",
    "--format",
    "json",
    "--from-receipt",
    receiptPath,
    "--no-artifacts",
  ]),
);
if (!incremental.incremental?.enabled) throw new Error("second review should reuse the receipt");
if (!incremental.incremental.reusedFiles.length) throw new Error("second review should reuse unchanged files");
const incrementalT02 = incremental.findings.find((item) => item.id === "T-02");
if (incrementalT02?.status !== "pass") throw new Error(`incremental T-02 expected pass, got ${incrementalT02?.status}`);
if (!incremental.fileMap?.files.some((item) => item.file === "src/tools.mjs")) {
  throw new Error("incremental report is missing the file map");
}

const sarifOut = run([join(root, "fixtures/core-permission-fail"), "--profiles", "core", "--format", "sarif", "--no-artifacts"]);
JSON.parse(sarifOut);

try {
  execFileSync("node", [review, join(root, "fixtures/core-permission-fail"), "--profiles", "core", "--format", "json", "--ci"], { encoding: "utf8" });
  throw new Error("expected CI exit 1");
} catch (error) {
  if (error.status !== 1) throw error;
}

console.log("reporting, CI, AST, compare, artifacts, and incremental tests passed");
