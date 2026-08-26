import { execFileSync } from "node:child_process";
import { CORE_CRITICAL_IDS, CORE_HIGH_IDS, VERSION, RULE_VERSION } from "./constants.mjs";
import { STANDARDS } from "./standards.mjs";

export function readCommitSha(target) {
  try {
    return execFileSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function riskRank(risk) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[risk] ?? 4;
}

function statusRank(status) {
  return { fail: 0, partial: 1, unknown: 2, "manual-review": 3, pass: 4, "not-applicable": 5 }[status] ?? 6;
}

export function releaseConclusion(findings) {
  const applicable = findings.filter((item) => item.status !== "not-applicable");
  const criticalFails = applicable.filter((item) => item.risk === "Critical" && item.status === "fail");
  const highFails = applicable.filter((item) => item.risk === "High" && item.status === "fail");
  const criticalCount = criticalFails.length;
  const highCount = highFails.length;
  const coreHigh = applicable.filter((item) => CORE_HIGH_IDS.includes(item.id) || CORE_CRITICAL_IDS.includes(item.id));
  const evalPass = findings.find((item) => item.id === "E-01")?.status === "pass";
  let status = "conditional";
  if (criticalCount > 0) status = "blocked";
  else if (highCount > 0) status = "conditional";
  else if (coreHigh.every((item) => item.status === "pass") && evalPass) status = "ready-for-pilot";
  return { status, criticalCount, highCount };
}

function evidenceSummary(evidence) {
  if (!evidence.length) return "none";
  const first = evidence[0];
  return `${first.type}:${first.file}:${first.line}`;
}

function evidenceTypes(evidence) {
  return [...new Set(evidence.map((item) => item.type))].join(", ") || "none";
}

export function qualityStats(findings, durationMs) {
  const applicable = findings.filter((item) => item.status !== "not-applicable");
  const manual = applicable.filter((item) => item.status === "manual-review").length;
  const types = { code: 0, test: 0, runtime: 0, documentation: 0, configuration: 0 };
  for (const finding of findings) {
    for (const item of finding.evidence) {
      if (types[item.type] != null) types[item.type] += 1;
    }
  }
  return {
    ruleCount: STANDARDS.length,
    standardCoverage: applicable.length,
    manualReviewRatio: applicable.length ? Number((manual / applicable.length).toFixed(4)) : 0,
    durationMs,
    evidenceSummary: types,
  };
}

function formatLatency(latency) {
  if (!latency) return "unavailable";
  return `p50=${latency.p50} p95=${latency.p95}`;
}

export function toMarkdown(report) {
  const findingsRows = report.findings
    .filter((item) => item.status !== "not-applicable")
    .sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || statusRank(a.status) - statusRank(b.status))
    .map((item) => `| ${item.id} | ${item.status} | ${item.risk} | ${item.confidence} | ${evidenceTypes(item.evidence)} | ${evidenceSummary(item.evidence)} | ${item.remediation || "—"} |`)
    .join("\n");

  const priority = report.findings
    .filter((item) => ["fail", "partial"].includes(item.status) && ["Critical", "High"].includes(item.risk))
    .sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || statusRank(a.status) - statusRank(b.status))
    .map((item, index) => `${index + 1}. ${item.id} (${item.risk}, ${item.status}): ${item.remediation}`)
    .slice(0, 8);

  const claims = (report.documentation.claims ?? [])
    .map((claim) => `- ${claim.source}: ${claim.claim} (${claim.verification})`)
    .join("\n");

  const comparison = report.comparison
    ? report.comparison.changes.map((item) => `- ${item.id}: ${item.from ?? "new"} → ${item.to}`).join("\n")
    : "- no previous report compared";

  const mapRows = (report.fileMap?.files ?? [])
    .map((item) => `- ${item.layer}: \`${item.file}\`${item.roles?.length ? ` (${item.roles.join(", ")})` : ""}`)
    .join("\n");

  const layers = (report.fileMap?.layers ?? []).map((item) => `- ${item.id}: ${item.files.join(", ")}`).join("\n");

  const incremental = report.incremental?.enabled
    ? `- Reused: ${report.incremental.reusedFiles.length}\n- Rescanned: ${report.incremental.rescannedFiles.length}\n- Added: ${report.incremental.addedFiles.length}\n- Removed: ${report.incremental.removedFiles.length}`
    : "- Full scan (no receipt loaded)";

  return `# Agent Framework Review

## Scope

- Project: ${report.target}
- Commit: ${report.commitSha ?? "unavailable"}
- Review tool version: ${report.version}
- Rule version: ${report.ruleVersion}
- Scan time: ${report.scannedAt}
- Applicable profiles: ${report.profiles.join(", ")}
- Evidence methods: ${report.evidenceMethods.join(", ")}

## Release conclusion

- Status: ${report.release.status}
- Critical findings: ${report.release.criticalCount}
- High findings: ${report.release.highCount}

## Findings

| ID | Status | Risk | Confidence | Evidence type | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
${findingsRows || "| — | — | — | — | — | — | — |"}

## Documentation claims

${claims || "- none indexed"}

## Metric baseline

- Success rate: ${report.metrics.successRate ?? "unavailable"}
- Latency: ${formatLatency(report.metrics.latency)}
- Cost: ${report.metrics.cost ?? "unavailable"}
- Tool calls: ${report.metrics.toolCalls ?? "unavailable"}

## Comparison

${comparison}

## Incremental scan

${incremental}

## File mapping

${mapRows || "- none"}

## Hierarchy

${layers || "- none"}

## Remediation priority

${priority.join("\n") || "1. No Critical or High gaps requiring immediate remediation."}

## Limitations

${report.limitations.map((item) => `- ${item}`).join("\n")}
`;
}

export function buildReport({
  target,
  discovered,
  documentation,
  findings,
  profiles,
  profileRationale,
  durationMs,
  commitSha,
  traces,
  testExecution,
  comparison,
  structure,
  fileMap,
  incremental,
  inventory,
  capabilities,
}) {
  const release = releaseConclusion(findings);
  const methods = ["static-scan", "documentation", "structural"];
  if (discovered.capabilities.hasTraces) methods.push("runtime-traces");
  if (testExecution?.executed) methods.push("executed-tests");
  const limitations = [
    testExecution?.executed
      ? `Authorized tests were executed (${testExecution.command?.label ?? "test"}); exit ${testExecution.exitCode}.`
      : "Tests were discovered but not executed unless --execute-tests was passed.",
    traces?.imported || traces?.events?.length ? "Runtime traces were imported from JSONL or OpenTelemetry exports." : "Runtime traces were imported only when JSONL/trace files were present.",
    "Comments and unused helpers cannot establish a structural pass.",
    "Documentation never independently produces a pass.",
  ];
  if (!discovered.capabilities.hasTests) limitations.push("No test files were discovered.");
  return {
    target,
    scannedAt: new Date().toISOString(),
    durationMs,
    commitSha,
    version: VERSION,
    ruleVersion: RULE_VERSION,
    scannedFiles: discovered.files.length,
    languages: discovered.languages,
    profiles,
    profileRationale,
    evidenceMethods: methods,
    findings,
    documentation,
    structure: structure
      ? {
          criticalPath: structure.criticalPath,
          t02: { gated: Boolean(structure.t02?.gated), bypass: Boolean(structure.t02?.bypass) },
          t03: { gated: Boolean(structure.t03?.gated), bypass: Boolean(structure.t03?.bypass) },
          r02: { validated: Boolean(structure.r02?.validated), bypass: Boolean(structure.r02?.bypass) },
          r03: { guarded: Boolean(structure.r03?.guarded), bypass: Boolean(structure.r03?.bypass) },
          o03: { redacted: Boolean(structure.o03?.redacted), leak: Boolean(structure.o03?.leak) },
          functions: structure.functions ?? [],
        }
      : undefined,
    fileMap,
    incremental: incremental ?? { enabled: false, reusedFiles: [], rescannedFiles: [], addedFiles: [], removedFiles: [] },
    inventory,
    capabilities,
    release,
    metrics: traces?.metrics ?? { successRate: null, latency: null, cost: null, toolCalls: null },
    quality: qualityStats(findings, durationMs),
    comparison,
    testExecution: testExecution ?? { executed: false, commands: discovered.testCommands },
    limitations,
  };
}
