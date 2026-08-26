const SARIF_VERSION = "2.1.0";

const LEVEL = {
  Critical: "error",
  High: "error",
  Medium: "warning",
  Low: "note",
};

export function toSarif(report) {
  const rules = report.findings.map((finding) => ({
    id: finding.id,
    shortDescription: { text: finding.requirement },
    help: { text: finding.acceptanceCriteria },
    defaultConfiguration: { level: LEVEL[finding.risk] ?? "warning" },
    properties: { risk: finding.risk, profile: finding.profile },
  }));

  const results = report.findings
    .filter((finding) => ["fail", "partial"].includes(finding.status))
    .map((finding) => {
      const evidence = finding.evidence[0];
      const location = evidence
        ? {
            physicalLocation: {
              artifactLocation: { uri: evidence.file },
              region: { startLine: evidence.line || 1, snippet: { text: evidence.snippet ?? "" } },
            },
          }
        : undefined;
      return {
        ruleId: finding.id,
        level: finding.status === "fail" ? "error" : "warning",
        message: { text: `${finding.id} ${finding.status}: ${finding.rationale || finding.remediation}` },
        locations: location ? [location] : [],
        properties: {
          status: finding.status,
          risk: finding.risk,
          confidence: finding.confidence,
          acceptanceCriteria: finding.acceptanceCriteria,
        },
      };
    });

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: "agent-framework-review",
            version: report.version,
            informationUri: "https://github.com/startforge/agent-readiness-audit",
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: report.scannedAt,
          },
        ],
        properties: {
          profiles: report.profiles,
          commitSha: report.commitSha,
          ruleVersion: report.ruleVersion,
        },
      },
    ],
  };
}

export function compareReports(current, previous) {
  const previousById = Object.fromEntries((previous.findings ?? []).map((item) => [item.id, item]));
  const changes = [];
  for (const finding of current.findings) {
    const before = previousById[finding.id];
    if (!before) {
      changes.push({ id: finding.id, from: null, to: finding.status, risk: finding.risk });
      continue;
    }
    if (before.status !== finding.status) {
      changes.push({ id: finding.id, from: before.status, to: finding.status, risk: finding.risk });
    }
  }
  const newCriticalFails = changes.filter((item) => item.risk === "Critical" && item.to === "fail" && item.from !== "fail");
  const resolved = changes.filter((item) => item.from === "fail" && item.to !== "fail");
  return { changes, newCriticalFails, resolved };
}

export function ciExitCode(report, options = {}, comparison = null) {
  const failOn = new Set((options.failOn ?? ["critical"]).map((item) => item.toLowerCase()));
  const applicable = report.findings.filter((item) => item.status !== "not-applicable");
  if (failOn.has("critical") && applicable.some((item) => item.risk === "Critical" && item.status === "fail")) return 1;
  if (failOn.has("high") && applicable.some((item) => item.risk === "High" && item.status === "fail")) return 1;
  if (failOn.has("partial") && applicable.some((item) => ["Critical", "High"].includes(item.risk) && item.status === "partial")) return 1;
  if ((options.blockNewCritical ?? true) && comparison?.newCriticalFails?.length) return 1;
  return 0;
}
