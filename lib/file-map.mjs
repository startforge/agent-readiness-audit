import { EXECUTORS, GATES, APPROVALS, PARSERS, REDACTORS, RUNTIME, DANGEROUS } from "./structure.mjs";

const LAYER_ORDER = ["documentation", "runtime", "tools", "security", "observability", "tests", "configuration", "other"];

function layerFor(file, functions) {
  if (file.kind === "documentation") return "documentation";
  if (file.kind === "test") return "tests";
  if (file.kind === "runtime") return "observability";
  if (file.kind === "configuration") return "configuration";
  const fns = functions.filter((item) => item.fileRelative === file.relative);
  if (fns.some((item) => item.roles?.includes("runtime") || RUNTIME.has(item.name))) return "runtime";
  if (fns.some((item) => item.roles?.includes("executor") || EXECUTORS.has(item.name))) return "tools";
  if (fns.some((item) => ["permission-gate", "approval-gate", "redactor"].some((role) => item.roles?.includes(role)))) return "security";
  if (fns.some((item) => item.roles?.includes("trace-writer"))) return "observability";
  if (file.kind === "code") return "runtime";
  return "other";
}

function standardsForFile(relative, findings) {
  return findings
    .filter((finding) => finding.evidence?.some((item) => item.file === relative))
    .map((finding) => finding.id);
}

export function buildFileMap({ files, functions = [], findings = [], documentation = {}, structure = {} }) {
  const functionList = functions;
  const mapped = files.map((file) => {
    const fns = functionList.filter((item) => item.fileRelative === file.relative);
    const roles = [...new Set(fns.flatMap((item) => item.roles ?? []))];
    return {
      file: file.relative,
      kind: file.kind,
      language: file.language,
      layer: layerFor(file, functionList),
      roles,
      functions: fns.map((item) => item.name),
      standards: standardsForFile(file.relative, findings),
      reused: Boolean(file.reused),
    };
  });

  const layers = LAYER_ORDER
    .map((id) => ({ id, files: mapped.filter((item) => item.layer === id).map((item) => item.file) }))
    .filter((item) => item.files.length);

  const edges = [];
  for (const claim of documentation.claims ?? []) {
    for (const area of claim.expectedCodeAreas ?? []) {
      const target = mapped.find((item) => item.file.replace(/\.[^.]+$/, "") === area || item.file.startsWith(`${area}.`));
      if (target) {
        edges.push({ from: claim.source, to: target.file, kind: "claim", label: claim.claim.slice(0, 80) });
      }
    }
  }
  for (const fn of functionList) {
    for (const call of fn.calls ?? []) {
      const callee = functionList.find((item) => item.name === call.name);
      if (!callee || callee.fileRelative === fn.fileRelative && callee.name === fn.name) continue;
      if (EXECUTORS.has(fn.name) || RUNTIME.has(fn.name) || GATES.has(call.name) || APPROVALS.has(call.name) || PARSERS.has(call.name) || REDACTORS.has(call.name) || DANGEROUS.has(call.name)) {
        edges.push({ from: `${fn.fileRelative}#${fn.name}`, to: `${callee.fileRelative}#${callee.name}`, kind: "calls", label: `${fn.name} → ${call.name}` });
      }
    }
  }

  const uniqueEdges = [];
  const seen = new Set();
  for (const edge of edges) {
    const key = `${edge.kind}:${edge.from}:${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEdges.push(edge);
  }

  return {
    files: mapped,
    layers,
    edges: uniqueEdges.slice(0, 200),
    criticalPath: structure.criticalPath ?? { function: null, file: null, steps: [] },
    implementationMap: documentation.implementationMap ?? {},
  };
}
