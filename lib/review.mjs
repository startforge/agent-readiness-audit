import { resolve } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { PROFILES, VERSION } from "./constants.mjs";
import { discoverProject } from "./discovery.mjs";
import { indexDocumentation } from "./documentation.mjs";
import { collectEvidence } from "./evidence.mjs";
import { evaluateAll } from "./engine.mjs";
import { buildReport, readCommitSha } from "./report.mjs";
import { STANDARDS } from "./standards.mjs";
import { executeTestCommand } from "./tests.mjs";
import { compareReports } from "./sarif.mjs";
import { redactSnippet } from "./evidence-util.mjs";

export function parseArgs(argv) {
  const args = {
    target: null,
    profiles: null,
    format: "markdown",
    output: null,
    compare: null,
    executeTests: false,
    ci: false,
    failOn: ["critical"],
    help: false,
  };
  const rest = argv.slice(2);
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (item === "--profiles") {
      args.profiles = (rest[index + 1] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
    } else if (item === "--format") {
      args.format = rest[index + 1];
      index += 1;
    } else if (item === "--output") {
      args.output = rest[index + 1];
      index += 1;
    } else if (item === "--compare") {
      args.compare = rest[index + 1];
      index += 1;
    } else if (item === "--execute-tests") {
      args.executeTests = true;
    } else if (item === "--ci") {
      args.ci = true;
    } else if (item === "--fail-on") {
      args.failOn = (rest[index + 1] ?? "critical").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
      index += 1;
    } else if (item === "--help" || item === "-h") {
      args.help = true;
    } else if (!item.startsWith("-") && !args.target) {
      args.target = item;
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  if (args.format && !["markdown", "json", "sarif"].includes(args.format)) {
    throw new Error("Format must be json, markdown, or sarif");
  }
  if (args.profiles) {
    const unknown = args.profiles.filter((item) => !PROFILES.includes(item));
    if (unknown.length) throw new Error(`Unknown profiles: ${unknown.join(", ")}`);
  }
  return args;
}

export const USAGE = `Usage: node review-project.mjs <target-directory> [options]

Options:
  --profiles core,rag     Profiles to enable (core is always on)
  --format markdown|json|sarif
  --output file           Write the report to a file as well as stdout
  --compare previous.json Diff against a previous JSON report
  --execute-tests         Run discovered test commands (authorized only)
  --ci                    Read-only CI mode; non-zero exit on threshold breaches
  --fail-on critical,high CI failure threshold (default: critical)

Agent Framework Review v${VERSION}`;

function resolveProfiles(requested, suggested) {
  if (requested?.length) {
    const profiles = requested.includes("core") ? requested : ["core", ...requested];
    return {
      profiles: [...new Set(profiles)],
      rationale: "Profiles were selected explicitly. core is always enabled.",
    };
  }
  return {
    profiles: suggested,
    rationale: "core is always enabled; additional profiles were suggested from project evidence.",
  };
}

function loadPrevious(path) {
  if (!path) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function reviewProject(targetDirectory, options = {}) {
  const started = Date.now();
  const target = resolve(targetDirectory);
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    throw new Error(`Target directory not found: ${targetDirectory}`);
  }
  const discovered = discoverProject(target);
  const { profiles, rationale } = resolveProfiles(options.profiles, discovered.suggestedProfiles);
  const documentation = indexDocumentation(discovered);
  const { byId, structure, traces } = collectEvidence(discovered, STANDARDS);

  let testExecution = { executed: false, commands: discovered.testCommands };
  if (options.executeTests && discovered.testCommands[0]) {
    const result = executeTestCommand(discovered.testCommands[0]);
    testExecution = { executed: true, ...result };
    if (result.ok && byId["E-01"]) {
      byId["E-01"].push({
        type: "test",
        file: discovered.testCommands[0].source,
        line: 1,
        snippet: redactSnippet(result.stdout.split(/\n/).find((line) => line.trim()) ?? "tests passed"),
        reason: "Authorized test command exited 0",
        confidence: "medium",
      });
    }
  }

  const findings = evaluateAll(STANDARDS, byId, {
    profiles,
    capabilities: discovered.capabilities,
    structure,
  });
  const previous = options.compare ? loadPrevious(options.compare) : null;
  const comparison = previous ? compareReports({ findings }, previous) : undefined;
  return buildReport({
    target,
    discovered,
    documentation,
    findings,
    profiles,
    profileRationale: rationale,
    durationMs: Date.now() - started,
    commitSha: readCommitSha(target),
    traces,
    testExecution,
    comparison,
    structure,
  });
}
