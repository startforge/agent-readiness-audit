import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isComment, redactSnippet } from "./evidence-util.mjs";

export const FRAMEWORK_CATALOG = [
  {
    id: "mastra",
    npm: ["@mastra/core", "mastra", "@mastra/rag"],
    python: [],
    profiles: (hits) => {
      const profiles = [];
      if (hits.some((item) => item.standardId === "K-02" || /rag|vector/i.test(item.reason))) profiles.push("rag");
      if (hits.some((item) => /Workflow|createWorkflow/.test(item.reason))) profiles.push("workflow");
      return profiles;
    },
    apis: [
      { pattern: /\bnew\s+Agent\s*\(/, standardId: "R-01", reason: "Mastra Agent constructor" },
      { pattern: /\bcreateTool\s*\(/, standardId: "T-01", reason: "Mastra createTool" },
      { pattern: /\binputSchema\b/, standardId: "T-01", reason: "Mastra tool inputSchema" },
      { pattern: /\binputSchema\b/, standardId: "R-02", reason: "Mastra tool inputSchema validates tool intent" },
      { pattern: /\bmaxSteps\b/, standardId: "R-03", reason: "Mastra Agent maxSteps" },
      { pattern: /\bcreateWorkflow\s*\(|\bnew\s+Workflow\s*\(/, standardId: "W-01", reason: "Mastra Workflow constructor" },
      { pattern: /\b@mastra\/rag\b|\bvectorQuery\b|\bembed\w*\(/i, standardId: "K-02", reason: "Mastra RAG/embedding API" },
    ],
  },
  {
    id: "langgraph",
    npm: ["@langchain/langgraph", "@langchain/langgraph-sdk"],
    python: ["langgraph"],
    profiles: (hits) => (hits.some((item) => item.standardId === "R-01" || item.standardId === "W-01") ? ["workflow"] : []),
    apis: [
      { pattern: /\bStateGraph\b|\bcreateReactAgent\b|\bcreate_react_agent\b/, standardId: "R-01", reason: "LangGraph agent/graph constructor" },
      { pattern: /\bStateGraph\b|\bcreateReactAgent\b/, standardId: "W-01", reason: "LangGraph graph/role wiring" },
      { pattern: /\bToolNode\b|\btool\s*\(|\b@tool\b|\bStructuredTool\b/, standardId: "T-01", reason: "LangGraph/LangChain tool definition" },
      { pattern: /\brecursion_limit\b|\brecursionLimit\b/, standardId: "R-03", reason: "LangGraph recursion_limit" },
      { pattern: /\binterrupt_before\b|\binterruptBefore\b|\binterrupt\s*\(/, standardId: "T-03", reason: "LangGraph interrupt / HITL" },
      { pattern: /\.invoke\s*\(|\.ainvoke\s*\(|\.compile\s*\(/, standardId: "R-01", reason: "LangGraph compile/invoke" },
      { pattern: /\bz\.\w+\(|\bField\s*\(|\bBaseModel\b/, standardId: "R-02", reason: "Schema next to LangGraph tools" },
    ],
  },
  {
    id: "langchain",
    npm: ["langchain", "@langchain/core", "@langchain/openai"],
    python: ["langchain", "langchain-core", "langchain-openai"],
    profiles: () => [],
    apis: [
      { pattern: /\bAgentExecutor\b|\bcreateOpenAIToolsAgent\b|\bcreate_agent\b/, standardId: "R-01", reason: "LangChain agent constructor" },
      { pattern: /\bmaxIterations\b|\bmax_iterations\b/, standardId: "R-03", reason: "LangChain max iterations" },
      { pattern: /\bDynamicStructuredTool\b|\btool\s*\(/, standardId: "T-01", reason: "LangChain tool" },
    ],
  },
];

function resetPattern(pattern) {
  if (pattern.global) pattern.lastIndex = 0;
  return pattern;
}

function npmNames(text) {
  try {
    const pkg = JSON.parse(text);
    return new Set(
      ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].flatMap((key) => Object.keys(pkg[key] ?? {})),
    );
  } catch {
    return new Set();
  }
}

function pythonNames(text) {
  const names = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/#.*$/, "").trim().replace(/^["']|["']$/g, "");
    const match = trimmed.match(/^([A-Za-z0-9_.-]+)/);
    if (match) names.add(match[1].toLowerCase().replace(/_/g, "-"));
  }
  return names;
}

function readIfPresent(target, relative) {
  const full = join(target, relative);
  if (!existsSync(full)) return null;
  try {
    return { relative, text: readFileSync(full, "utf8") };
  } catch {
    return null;
  }
}

export function detectDeclaredFrameworks(target, files = []) {
  const npm = new Set();
  const python = new Set();
  for (const file of files) {
    if (file.text == null) continue;
    if (/(^|\/)package\.json$/i.test(file.relative)) {
      for (const name of npmNames(file.text)) npm.add(name);
    }
    if (/(^|\/)(pyproject\.toml|requirements[^/]*\.txt)$/i.test(file.relative)) {
      for (const name of pythonNames(file.text)) python.add(name);
    }
  }
  for (const extra of ["package.json", "pyproject.toml", "requirements.txt", "requirements.in"]) {
    if (files.some((file) => file.relative === extra)) continue;
    const loaded = readIfPresent(target, extra);
    if (!loaded) continue;
    if (extra === "package.json") for (const name of npmNames(loaded.text)) npm.add(name);
    else for (const name of pythonNames(loaded.text)) python.add(name);
  }

  return FRAMEWORK_CATALOG.filter(
    (item) => item.npm.some((name) => npm.has(name)) || item.python.some((name) => python.has(name.toLowerCase())),
  ).map((item) => ({
    id: item.id,
    packages: [...item.npm.filter((name) => npm.has(name)), ...item.python.filter((name) => python.has(name.toLowerCase()))],
  }));
}

function collectApiHits(file, framework) {
  if (file.text == null || (file.kind !== "code" && file.kind !== "test")) return [];
  const hits = [];
  const lines = file.text.split(/\r?\n/);
  for (const api of framework.apis) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (isComment(line, file.language)) continue;
      resetPattern(api.pattern);
      if (!api.pattern.test(line)) continue;
      hits.push({
        type: file.kind === "test" ? "test" : "code",
        file: file.relative,
        line: index + 1,
        snippet: redactSnippet(line.trim()),
        reason: api.reason,
        confidence: file.kind === "test" ? "medium" : "medium",
        analysis: "framework-api",
        framework: framework.id,
        standardId: api.standardId,
      });
    }
  }
  return hits;
}

export function scanFrameworkUsage(files, declared) {
  const used = [];
  const evidence = [];
  for (const declaredItem of declared) {
    const catalog = FRAMEWORK_CATALOG.find((item) => item.id === declaredItem.id);
    if (!catalog) continue;
    const hits = files.flatMap((file) => collectApiHits(file, catalog));
    const unique = [];
    const seen = new Set();
    for (const hit of hits) {
      const key = `${hit.standardId}:${hit.file}:${hit.line}:${hit.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(hit);
    }
    evidence.push(...unique);
    used.push({
      id: catalog.id,
      packages: declaredItem.packages,
      used: unique.length > 0,
      profiles: unique.length ? catalog.profiles(unique) : [],
      callSites: unique.length,
    });
  }
  return {
    declared: used,
    used: used.filter((item) => item.used),
    evidence,
    mode: used.some((item) => item.used) ? "framework-api" : "custom",
  };
}

export function inspectFrameworks(target, files) {
  const declared = detectDeclaredFrameworks(target, files);
  return scanFrameworkUsage(files, declared);
}

export function applyFrameworkStructure(structure, frameworkEvidence = []) {
  const ids = new Set(frameworkEvidence.filter((item) => item.type === "code").map((item) => item.standardId));
  const next = { ...structure };
  if (ids.has("R-02") && !next.r02?.bypass) next.r02 = { ...next.r02, validated: true };
  if (ids.has("R-03") && !next.r03?.bypass) next.r03 = { ...next.r03, guarded: true };
  if (ids.has("T-03") && !next.t03?.bypass) next.t03 = { ...next.t03, gated: true };
  const extra = frameworkEvidence
    .filter((item) => item.type === "code")
    .map((item) => ({
      id: item.standardId,
      type: "code",
      file: item.file,
      line: item.line,
      snippet: item.snippet,
      reason: item.reason,
      confidence: "medium",
      analysis: "framework-api",
    }));
  next.evidence = [...(next.evidence ?? []), ...extra];
  return next;
}
