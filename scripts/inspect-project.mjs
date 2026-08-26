import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const target = process.argv[2];
if (!target) throw new Error("用法：node inspect-project.mjs <target-directory>");
const ignored = new Set(["node_modules", ".git", ".data", "dist", "build", "coverage"]);
const allowed = /\.(ts|tsx|js|mjs|md|json)$/;
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name === "agent.config.json" || entry.name === ".env") continue;
    const full = join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (allowed.test(entry.name)) files.push(full);
  }
}
walk(target);
const source = files.map((file) => ({ file: relative(target, file), text: readFileSync(file, "utf8"), isCode: /\.(ts|tsx|js|mjs)$/.test(file) }));
const checks = [
  ["R-01", /AgentRuntime|observe|think|tool call|WorkflowGraph/i],
  ["R-02", /zod|schema|JSON\.parse|askJson|structured/i],
  ["R-03", /maxSteps|maxDuration|timeout|LoopGuard|budget/i],
  ["R-04", /SessionStore|TaskState|session/i],
  ["R-05", /ContextBuilder|compact|limitContext|maxContext/i],
  ["T-01", /ToolRegistry|inputSchema|tool.*schema/i],
  ["T-02", /PermissionGate|authorize|allowlist|whitelist/i],
  ["T-03", /confirm|approval|human.?approval/i],
  ["O-01", /TraceLogger|trace\.record|jsonl/i],
  ["O-02", /latency|estimatedCost|usage|toolCalls/i],
  ["O-03", /redact|sanitize|secret|api.?key/i],
  ["E-01", /eval|smoke.?test|regression|test\(/i],
  ["E-02", /failureCategory|classifyFailure|prompt.*tool.*state/i],
  ["S-01", /prompt.?injection|exfiltration|tool.?abuse|risk/i],
  ["K-01", /chunk|embedding|retriev/i],
  ["W-01", /Planner|Reviewer|Critic|Supervisor/i],
  ["SK-01", /SKILL\.md|SkillRegistry|SkillManifest/i],
  ["B-01", /BrowserSession|Playwright|screenshot|navigate/i],
];
function matches(pattern, isCode) {
  return source.filter((entry) => entry.isCode === isCode && pattern.test(entry.text)).slice(0, 5).map(({ file }) => file);
}
const codeEvidence = Object.fromEntries(checks.map(([id, pattern]) => [id, matches(pattern, true)]));
const documentationEvidence = Object.fromEntries(checks.map(([id, pattern]) => [id, matches(pattern, false)]));
console.log(JSON.stringify({ target, scannedFiles: files.length, codeEvidence, documentationEvidence, note: "代码证据仅代表候选实现；文档证据不能作为通过依据。请结合代码阅读、测试和运行 Trace 复核。" }, null, 2));
