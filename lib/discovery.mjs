import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import {
  ALLOWED_EXTENSIONS,
  IGNORED_DIRECTORIES,
  MAX_FILE_BYTES,
  SECRET_FILE_NAMES,
  SECRET_FILE_PATTERN,
} from "./constants.mjs";
import { discoverTestCommands, extractBinaryDocuments } from "./tests.mjs";

function toPosix(path) {
  return path.split(sep).join("/");
}

function isSecretFile(name, relativePath) {
  return SECRET_FILE_NAMES.has(name) || SECRET_FILE_PATTERN.test(relativePath) || SECRET_FILE_PATTERN.test(name);
}

export function isFixtureProject(root) {
  return existsSync(join(root, "expected.json")) || basename(dirname(root)) === "fixtures";
}

export function classifyFile(relativePath) {
  const name = relativePath.split("/").pop() ?? relativePath;
  if (/\.(md|docx|pdf)$/i.test(name)) return "documentation";
  if (/\.jsonl$/i.test(name) || /(^|\/)traces?\//i.test(relativePath)) return "runtime";
  if (/\.(json|ya?ml|yml|toml)$/i.test(name)) return "configuration";
  if (/(^|\/)(tests?|__tests__|spec)\//i.test(relativePath) || /\.(test|spec)\./i.test(name) || /(^|\/)smoke-test\./i.test(relativePath)) {
    return "test";
  }
  if (/\.(ts|tsx|js|mjs|cjs|py|sh)$/i.test(name)) return "code";
  return "other";
}

export function detectLanguage(relativePath) {
  const name = relativePath.split("/").pop() ?? relativePath;
  if (/\.tsx$/i.test(name)) return "tsx";
  if (/\.ts$/i.test(name)) return "ts";
  if (/\.(js|mjs|cjs)$/i.test(name)) return "js";
  if (/\.py$/i.test(name)) return "py";
  if (/\.sh$/i.test(name)) return "sh";
  if (/\.md$/i.test(name)) return "md";
  if (/\.json$/i.test(name)) return "json";
  if (/\.jsonl$/i.test(name)) return "jsonl";
  if (/\.ya?ml$/i.test(name)) return "yaml";
  if (/\.toml$/i.test(name)) return "toml";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.docx$/i.test(name)) return "docx";
  return "other";
}

function walk(directory, root, files, fixtureRoot) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    if (entry.name === "fixtures" && !fixtureRoot) continue;
    const full = join(directory, entry.name);
    const rel = toPosix(relative(root, full));
    if (isSecretFile(entry.name, rel) || entry.name === "expected.json") continue;
    if (entry.isDirectory()) {
      walk(full, root, files, fixtureRoot);
      continue;
    }
    if (!entry.isFile() || !ALLOWED_EXTENSIONS.test(entry.name)) continue;
    let size = 0;
    try {
      size = statSync(full).size;
    } catch {
      continue;
    }
    if (size > MAX_FILE_BYTES) continue;
    let text = "";
    if (/\.(docx|pdf)$/i.test(entry.name)) {
      text = extractBinaryDocuments(root, rel) ?? "";
      if (!text) continue;
    } else {
      try {
        text = readFileSync(full, "utf8");
      } catch {
        continue;
      }
    }
    files.push({
      file: full,
      relative: rel,
      text,
      kind: classifyFile(rel),
      language: detectLanguage(rel),
    });
  }
}

export function detectCapabilities(files) {
  const production = files.filter((item) => item.kind === "code").map((item) => item.text).join("\n");
  const all = files.map((item) => item.text).join("\n");
  return {
    hasTools: /executeTool|ToolRegistry|inputSchema|toolCall|callTool|runTool|function.?call|execute_tool/i.test(production),
    hasDangerousActions: /\b(deleteFile|delete_file|sendMessage|send_message|createPayment|publishPost|rm -rf|drop table)\b/i.test(production),
    hasRag: /chunk|embedding|retriev|vector store/i.test(all),
    hasWorkflow: /\bPlanner\b|\bReviewer\b|\bCritic\b|\bSupervisor\b|multi-?agent/i.test(all),
    hasSkill: files.some((item) => /(^|\/)SKILL\.md$/i.test(item.relative)) || /SkillRegistry|SkillManifest/.test(all),
    hasBrowser: /Playwright|BrowserSession|puppeteer|computer.?use/i.test(all),
    hasTests: files.some((item) => item.kind === "test"),
    hasTraces: files.some((item) => item.kind === "runtime" || /\.jsonl$/i.test(item.relative)),
  };
}

export function suggestProfiles(capabilities) {
  const profiles = ["core"];
  if (capabilities.hasRag) profiles.push("rag");
  if (capabilities.hasWorkflow) profiles.push("workflow");
  if (capabilities.hasSkill) profiles.push("skill");
  if (capabilities.hasBrowser) profiles.push("browser");
  return profiles;
}

export function discoverProject(target) {
  const files = [];
  const fixtureRoot = isFixtureProject(target);
  walk(target, target, files, fixtureRoot);
  const capabilities = detectCapabilities(files);
  const languages = [...new Set(files.map((item) => item.language).filter((item) => item !== "other" && item !== "md"))];
  const entryPoints = files
    .filter((item) => item.kind === "code")
    .map((item) => item.relative)
    .filter((rel) => /(^|\/)(index|main|app|runtime|agent|server)\./i.test(rel) || /(^|\/)src\//.test(rel))
    .slice(0, 20);
  return {
    target,
    files,
    capabilities,
    languages,
    entryPoints,
    suggestedProfiles: suggestProfiles(capabilities),
    testCommands: discoverTestCommands(target, files),
  };
}
