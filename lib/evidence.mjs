import { isComment, redactSnippet } from "./evidence-util.mjs";
import { analyzeStructure } from "./structure.mjs";
import { importTraces } from "./traces.mjs";

export { redactSnippet };

function resetPattern(pattern) {
  if (pattern.global) pattern.lastIndex = 0;
  return pattern;
}

function matchesLine(pattern, line) {
  resetPattern(pattern);
  return pattern.test(line);
}

function evidenceConfidence(type) {
  if (type === "runtime") return "high";
  if (type === "test") return "medium";
  if (type === "code" || type === "configuration") return "low";
  return "low";
}

function collectPatternEvidence(file, patterns, type) {
  if (!patterns?.length) return [];
  const evidence = [];
  const lines = file.text.split(/\r?\n/);
  for (const { pattern, reason } of patterns) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (isComment(line, file.language)) continue;
      if (!matchesLine(pattern, line)) continue;
      evidence.push({
        type,
        file: file.relative,
        line: index + 1,
        snippet: redactSnippet(line.trim()),
        reason,
        confidence: evidenceConfidence(type),
      });
    }
  }
  return evidence;
}

function uniqueEvidence(items) {
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.type}:${item.file}:${item.line}:${item.reason ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique.slice(0, 12);
}

export function collectEvidence(discovered, standards) {
  const byId = Object.fromEntries(standards.map((item) => [item.id, []]));
  const structure = analyzeStructure(discovered.files);
  const traces = importTraces(discovered.files);

  for (const standard of standards) {
    const collected = [];
    for (const file of discovered.files) {
      if (file.kind === "code") collected.push(...collectPatternEvidence(file, standard.code, "code"));
      if (file.kind === "test") collected.push(...collectPatternEvidence(file, standard.test ?? standard.code, "test"));
      if (file.kind === "configuration") collected.push(...collectPatternEvidence(file, standard.configuration, "configuration"));
      if (file.kind === "documentation") collected.push(...collectPatternEvidence(file, standard.documentation, "documentation"));
    }
    byId[standard.id] = uniqueEvidence(collected);
  }

  for (const item of structure.evidence) {
    const { id, ...rest } = item;
    if (!byId[id]) continue;
    byId[id] = uniqueEvidence([...byId[id], rest]);
  }

  for (const item of traces.evidence) {
    const { standardId, ...rest } = item;
    if (!byId[standardId]) continue;
    byId[standardId] = uniqueEvidence([...byId[standardId], rest]);
  }

  if (discovered.capabilities.hasTests) {
    const testFile = discovered.files.find((item) => item.kind === "test");
    if (testFile && !byId["E-01"].some((item) => item.type === "test")) {
      byId["E-01"].push({
        type: "test",
        file: testFile.relative,
        line: 1,
        snippet: redactSnippet(testFile.text.split(/\r?\n/).find((line) => line.trim()) ?? testFile.relative),
        reason: "Repeatable test file is present",
        confidence: "medium",
      });
    }
  }

  return { byId, structure, traces };
}
