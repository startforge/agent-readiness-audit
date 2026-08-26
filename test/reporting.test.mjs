import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { reviewProject } from "../lib/review.mjs";
import { ciExitCode, compareReports, toSarif } from "../lib/sarif.mjs";
import { stripJsComments, parseModule } from "../lib/ast.mjs";

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
