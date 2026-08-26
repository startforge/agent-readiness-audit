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

function listWalk(directory, root, listing, fixtureRoot) {
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
    if (isSecretFile(entry.name, rel) || entry.name === "expected.json" || entry.name === "receipt.json" || entry.name === "map.json" || entry.name === "report.json") continue;
    if (entry.isDirectory()) {
      listWalk(full, root, listing, fixtureRoot);
      continue;
    }
    if (!entry.isFile() || !ALLOWED_EXTENSIONS.test(entry.name)) continue;
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.size > MAX_FILE_BYTES) continue;
    listing.push({
      full,
      relative: rel,
      name: entry.name,
      size: stats.size,
      mtimeMs: Math.trunc(stats.mtimeMs),
    });
  }
}

function readEntry(root, entry) {
  let text = "";
  if (/\.(docx|pdf)$/i.test(entry.name)) {
    text = extractBinaryDocuments(root, entry.relative) ?? "";
    if (!text) return null;
  } else {
    try {
      text = readFileSync(entry.full, "utf8");
    } catch {
      return null;
    }
  }
  const kind = classifyFile(entry.relative);
  const language = detectLanguage(entry.relative);
  const file = { file: entry.full, relative: entry.relative, text, kind, language, size: entry.size, mtimeMs: entry.mtimeMs, reused: false };
  file.capabilityFlags = fileCapabilityFlags(file);
  return file;
}

export function fileCapabilityFlags(file) {
  if (file.capabilityFlags && file.text == null) return file.capabilityFlags;
  const production = file.kind === "code" ? file.text ?? "" : "";
  const all = file.text ?? "";
  return {
    hasTools: /executeTool|ToolRegistry|inputSchema|toolCall|callTool|runTool|function.?call|execute_tool/i.test(production),
    hasDangerousActions: /\b(deleteFile|delete_file|sendMessage|send_message|createPayment|publishPost|rm -rf|drop table)\b/i.test(production),
    hasRag: /chunk|embedding|retriev|vector store/i.test(all),
    hasWorkflow: /\bPlanner\b|\bReviewer\b|\bCritic\b|\bSupervisor\b|multi-?agent/i.test(all),
    hasSkill: /(^|\/)SKILL\.md$/i.test(file.relative) || /SkillRegistry|SkillManifest/.test(all),
    hasBrowser: /Playwright|BrowserSession|puppeteer|computer.?use/i.test(all),
    hasTests: file.kind === "test",
    hasTraces: file.kind === "runtime" || /\.jsonl$/i.test(file.relative),
  };
}

export function detectCapabilities(files) {
  const flags = files.map((item) => item.capabilityFlags ?? fileCapabilityFlags(item));
  const any = (key) => flags.some((item) => item[key]);
  return {
    hasTools: any("hasTools"),
    hasDangerousActions: any("hasDangerousActions"),
    hasRag: any("hasRag"),
    hasWorkflow: any("hasWorkflow"),
    hasSkill: any("hasSkill"),
    hasBrowser: any("hasBrowser"),
    hasTests: any("hasTests"),
    hasTraces: any("hasTraces"),
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

export function discoverProject(target, options = {}) {
  const listing = [];
  const fixtureRoot = isFixtureProject(target);
  listWalk(target, target, listing, fixtureRoot);
  const receipt = options.full ? null : options.receipt;
  const canReuse = Boolean(receipt && receipt.ruleVersion === options.ruleVersion);
  const previous = Object.fromEntries((receipt?.inventory ?? []).map((item) => [item.relative, item]));
  const incremental = {
    enabled: canReuse,
    reusedFiles: [],
    rescannedFiles: [],
    addedFiles: [],
    removedFiles: canReuse ? (receipt.inventory ?? []).filter((item) => !listing.some((entry) => entry.relative === item.relative)).map((item) => item.relative) : [],
  };

  const files = [];
  for (const entry of listing) {
    const prior = previous[entry.relative];
    const reuse = canReuse && prior && prior.size === entry.size && prior.mtimeMs === entry.mtimeMs;
    if (reuse) {
      incremental.reusedFiles.push(entry.relative);
      files.push({
        file: entry.full,
        relative: entry.relative,
        text: null,
        reused: true,
        kind: prior.kind ?? classifyFile(entry.relative),
        language: prior.language ?? detectLanguage(entry.relative),
        size: entry.size,
        mtimeMs: entry.mtimeMs,
        capabilityFlags: prior.capabilityFlags ?? {},
      });
      continue;
    }
    const loaded = readEntry(target, entry);
    if (!loaded) continue;
    files.push(loaded);
    if (canReuse && prior) incremental.rescannedFiles.push(entry.relative);
    else if (canReuse) incremental.addedFiles.push(entry.relative);
  }

  if (canReuse && files.some((file) => file.kind === "runtime" && !file.reused)) {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (file.kind !== "runtime" || !file.reused) continue;
      const entry = listing.find((item) => item.relative === file.relative);
      const loaded = entry ? readEntry(target, entry) : null;
      if (!loaded) continue;
      files[index] = loaded;
      incremental.reusedFiles = incremental.reusedFiles.filter((path) => path !== loaded.relative);
      if (!incremental.rescannedFiles.includes(loaded.relative)) incremental.rescannedFiles.push(loaded.relative);
    }
  }

  const capabilities = detectCapabilities(files);
  const languages = [...new Set(files.map((item) => item.language).filter((item) => item !== "other" && item !== "md"))];
  const entryPoints = files
    .filter((item) => item.kind === "code")
    .map((item) => item.relative)
    .filter((rel) => /(^|\/)(index|main|app|runtime|agent|server)\./i.test(rel) || /(^|\/)src\//.test(rel))
    .slice(0, 20);
  const liveForCommands = files.filter((item) => item.text != null);
  const testCommands = liveForCommands.length ? discoverTestCommands(target, liveForCommands) : receipt?.testCommands ?? [];
  return {
    target,
    files,
    capabilities,
    languages,
    entryPoints,
    suggestedProfiles: suggestProfiles(capabilities),
    testCommands,
    incremental,
  };
}
