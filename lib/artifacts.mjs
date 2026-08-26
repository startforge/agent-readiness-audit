import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { ARTIFACTS_DIR_NAME, RULE_VERSION, VERSION } from "./constants.mjs";
import { toMarkdown } from "./report.mjs";
import { renderMapHtml, renderReportHtml } from "./map-html.mjs";
import { buildReviewXlsx } from "./workbook.mjs";

export function loadReceipt(path) {
  if (!path) return null;
  const file = existsSync(path) && path.endsWith(".json") ? path : join(path, "receipt.json");
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (parsed.kind !== "agent-framework-review-receipt") {
    if (parsed.findings && parsed.fileMap) return parsed;
    if (parsed.findings) return parsed;
  }
  return parsed;
}

export function buildReceipt({ report, discovered, documentation, structure, traces, fileMap, evidenceById }) {
  const evidence = [];
  for (const [standardId, items] of Object.entries(evidenceById ?? {})) {
    for (const item of items) evidence.push({ standardId, ...item });
  }
  return {
    kind: "agent-framework-review-receipt",
    version: VERSION,
    ruleVersion: RULE_VERSION,
    scannedAt: report.scannedAt,
    target: report.target,
    commitSha: report.commitSha,
    profiles: report.profiles,
    capabilities: discovered.capabilities,
    testCommands: discovered.testCommands,
    inventory: discovered.files.map((file) => ({
      relative: file.relative,
      size: file.size ?? 0,
      mtimeMs: file.mtimeMs ?? 0,
      kind: file.kind,
      language: file.language,
      capabilityFlags: file.capabilityFlags ?? {},
    })),
    functions: structure.functions ?? [],
    evidence,
    documentation,
    fileMap,
    findings: report.findings,
    traces: traces ? { evidence: traces.evidence, metrics: traces.metrics } : null,
  };
}

export function buildReceiptFromReport(report) {
  const evidence = [];
  for (const finding of report.findings ?? []) {
    for (const item of finding.evidence ?? []) {
      evidence.push({ standardId: finding.id, ...item });
    }
  }
  return {
    kind: "agent-framework-review-receipt",
    version: report.version,
    ruleVersion: report.ruleVersion,
    scannedAt: report.scannedAt,
    target: report.target,
    commitSha: report.commitSha,
    profiles: report.profiles,
    capabilities: report.capabilities,
    testCommands: report.testExecution?.commands ?? [],
    inventory: report.inventory ?? [],
    functions: report.structure?.functions ?? [],
    evidence,
    documentation: report.documentation,
    fileMap: report.fileMap,
    findings: report.findings,
    traces: { evidence: evidence.filter((item) => item.type === "runtime"), metrics: report.metrics },
  };
}

export function defaultArtifactsDir(target) {
  return join(resolve(target), ARTIFACTS_DIR_NAME);
}

export function resolveArtifactsDir(args, target) {
  if (args.noArtifacts) return null;
  if (args.artifactsDir) {
    return isAbsolute(args.artifactsDir) ? args.artifactsDir : resolve(target, args.artifactsDir);
  }
  if (args.ci) return null;
  return defaultArtifactsDir(target);
}

export function writeArtifacts(directory, { report, receipt, fileMap }) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  writeFileSync(join(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(directory, "report.md"), toMarkdown(report));
  writeFileSync(join(directory, "report.xlsx"), buildReviewXlsx(report, fileMap));
  writeFileSync(join(directory, "report.html"), renderReportHtml(fileMap, report));
  writeFileSync(join(directory, "map.json"), `${JSON.stringify(fileMap, null, 2)}\n`);
  writeFileSync(join(directory, "map.html"), renderMapHtml(fileMap, report));
  return {
    directory,
    receipt: join(directory, "receipt.json"),
    reportJson: join(directory, "report.json"),
    reportMarkdown: join(directory, "report.md"),
    reportExcel: join(directory, "report.xlsx"),
    reportHtml: join(directory, "report.html"),
    mapJson: join(directory, "map.json"),
    mapHtml: join(directory, "map.html"),
  };
}

export function resolveReceiptPath(path) {
  if (!path) return null;
  return existsSync(path) && !path.endsWith(".json") ? join(path, "receipt.json") : path;
}
