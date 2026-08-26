import { buildXlsx } from "./xlsx.mjs";

function joinList(value) {
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
}

function evidenceCell(item) {
  if (!item) return "";
  return [item.type, item.file && item.line ? `${item.file}:${item.line}` : item.file, item.reason].filter(Boolean).join(" | ");
}

export function reviewWorkbookSheets(report, fileMap = report.fileMap ?? {}) {
  const findings = report.findings ?? [];
  const files = fileMap.files ?? [];
  const layers = fileMap.layers ?? [];
  const edges = fileMap.edges ?? [];
  const incremental = report.incremental ?? {};
  const summary = [
    ["Field", "Value"],
    ["Project", report.target],
    ["Commit", report.commitSha],
    ["Scanned at", report.scannedAt],
    ["Tool version", report.version],
    ["Rule version", report.ruleVersion],
    ["Profiles", joinList(report.profiles)],
    ["Release", report.release?.status],
    ["Critical findings", report.release?.criticalCount],
    ["High findings", report.release?.highCount],
    ["Scanned files", report.scannedFiles],
    ["Reused files", incremental.enabled ? incremental.reusedFiles?.length ?? 0 : "full scan"],
    ["Rescanned files", incremental.enabled ? incremental.rescannedFiles?.length ?? 0 : ""],
    ["Success rate", report.metrics?.successRate],
    ["Latency p50", report.metrics?.latency?.p50],
    ["Latency p95", report.metrics?.latency?.p95],
  ];
  return [
    { name: "Summary", rows: summary },
    {
      name: "Findings",
      rows: [
        ["ID", "Status", "Risk", "Confidence", "Evidence", "Rationale", "Remediation", "Acceptance"],
        ...findings.map((item) => [
          item.id,
          item.status,
          item.risk,
          item.confidence,
          evidenceCell(item.evidence?.[0]),
          item.rationale,
          item.remediation,
          item.acceptanceCriteria,
        ]),
      ],
    },
    {
      name: "Files",
      rows: [
        ["File", "Layer", "Kind", "Language", "Roles", "Functions", "Standards", "Scan"],
        ...files.map((item) => [
          item.file,
          item.layer,
          item.kind,
          item.language,
          joinList(item.roles),
          joinList(item.functions),
          joinList(item.standards),
          item.reused ? "reused" : "scanned",
        ]),
      ],
    },
    {
      name: "Hierarchy",
      rows: [["Layer", "Files"], ...layers.map((item) => [item.id, joinList(item.files)])],
    },
    {
      name: "Relationships",
      rows: [["Kind", "From", "To", "Label"], ...edges.map((item) => [item.kind, item.from, item.to, item.label])],
    },
    {
      name: "Evidence",
      rows: [
        ["Standard", "Type", "File", "Line", "Reason", "Snippet"],
        ...findings.flatMap((finding) =>
          (finding.evidence ?? []).map((item) => [finding.id, item.type, item.file, item.line, item.reason, item.snippet]),
        ),
      ],
    },
  ];
}

export function buildReviewXlsx(report, fileMap) {
  return buildXlsx(reviewWorkbookSheets(report, fileMap));
}
