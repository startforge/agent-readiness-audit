import { HIGH_VALUE_DOCS, ADR_DOCS } from "./constants.mjs";

const CLAIM_PATTERN =
  /tool|permission|PermissionGate|authorize|loop|schema|trace|eval|session|context|approv|retriev|embedding|skill|browser|budget|timeout|redact|inject|runtime|agent/i;

function isHighValueDocument(relativePath) {
  return (
    HIGH_VALUE_DOCS.test(relativePath) ||
    ADR_DOCS.test(relativePath) ||
    /(^|\/)docs\/.+\.md$/i.test(relativePath) ||
    (/schema/i.test(relativePath) && /\.(md|json|ya?ml)$/i.test(relativePath))
  );
}

function codeArea(relativePath) {
  return relativePath.replace(/\.[^.]+$/, "");
}

function candidateLines(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").trim(), number: index + 1 }))
    .filter((item) => item.line.length >= 20 && !item.line.startsWith("```") && CLAIM_PATTERN.test(item.line));
}

export function indexDocumentation(discovered) {
  const docs = discovered.files.filter((item) => item.kind === "documentation" && isHighValueDocument(item.relative));
  const implementationFiles = discovered.files.filter((item) => item.kind === "code" || item.kind === "test");
  const claims = [];

  for (const doc of docs) {
    for (const item of candidateLines(doc.text)) {
      const expectedCodeAreas = implementationFiles
        .filter((file) => file.kind === "code")
        .filter((file) => {
          if (/permission|PermissionGate|authorize|tool/i.test(item.line)) {
            return /authorize|PermissionGate|executeTool|allowlist|tool/i.test(file.text);
          }
          if (/trace|observ/i.test(item.line)) return /trace|jsonl|runId/i.test(file.text);
          return false;
        })
        .map((file) => codeArea(file.relative));
      const uniqueAreas = [...new Set(expectedCodeAreas)];
      const hasCode = uniqueAreas.some((area) =>
        implementationFiles.some((file) => file.kind === "code" && codeArea(file.relative) === area),
      );
      claims.push({
        claim: item.line.slice(0, 300),
        source: doc.relative,
        line: item.number,
        expectedCodeAreas: uniqueAreas.slice(0, 8),
        verification: hasCode ? "consistent" : "unverified",
      });
    }
  }

  const implementationMap = {
    tools: implementationFiles.filter((file) => /executeTool|ToolRegistry|inputSchema/i.test(file.text)).map((file) => codeArea(file.relative)),
    permissions: implementationFiles.filter((file) => /authorize|PermissionGate|allowlist/i.test(file.text)).map((file) => codeArea(file.relative)),
    tests: discovered.files.filter((file) => file.kind === "test").map((file) => codeArea(file.relative)),
  };

  const mismatches = [];
  for (const claim of claims) {
    if (claim.verification === "unverified") {
      mismatches.push({
        type: "documented-unverified",
        claim: claim.claim,
        source: claim.source,
        detail: "Architecture claim has no matching implementation files.",
      });
    }
  }
  const hasPermissionClaim = claims.some((claim) => /permission|PermissionGate|authorize/i.test(claim.claim));
  if (implementationMap.permissions.length > 0 && !hasPermissionClaim && docs.length > 0) {
    mismatches.push({
      type: "implemented-undocumented",
      claim: "Permission checks exist in code but are not described in high-value documents.",
      source: implementationMap.permissions[0],
      detail: "Maintainability finding: document the permission gate and its scope.",
    });
  }

  return { claims, implementationMap, mismatches };
}
