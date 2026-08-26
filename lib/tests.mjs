import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function parsePackageJson(files) {
  const file = files.find((item) => item.relative === "package.json");
  if (!file) return null;
  try {
    return JSON.parse(file.text);
  } catch {
    return null;
  }
}

export function discoverTestCommands(target, files) {
  const commands = [];
  const pkg = parsePackageJson(files);
  if (pkg?.scripts?.test) {
    commands.push({ source: "package.json", argv: ["npm", "test"], cwd: target, label: pkg.scripts.test });
  }
  const pyproject = files.find((item) => item.relative === "pyproject.toml" || item.relative === "pytest.ini");
  if (pyproject) commands.push({ source: pyproject.relative, argv: ["python3", "-m", "pytest", "-q"], cwd: target, label: "pytest" });

  const workflow = files.find((item) => /(^|\/)\.github\/workflows\/.+\.ya?ml$/i.test(item.relative));
  if (workflow) {
    const npmTest = /^\s*run:\s*npm test\s*$/m.test(workflow.text);
    if (npmTest && !commands.some((item) => item.label === pkg?.scripts?.test)) {
      commands.push({ source: workflow.relative, argv: ["npm", "test"], cwd: target, label: "npm test (CI)" });
    }
  }

  if (!commands.length) {
    const testFile = files.find((item) => item.kind === "test" && /\.(mjs|js|cjs)$/.test(item.relative));
    if (testFile) commands.push({ source: testFile.relative, argv: ["node", testFile.relative], cwd: target, label: `node ${testFile.relative}` });
  }
  return commands;
}

export function executeTestCommand(command, { timeoutMs = 30_000 } = {}) {
  try {
    const stdout = execFileSync(command.argv[0], command.argv.slice(1), {
      cwd: command.cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, exitCode: 0, stdout: stdout.slice(0, 4000), command };
  } catch (error) {
    return {
      ok: false,
      exitCode: error.status ?? 1,
      stdout: String(error.stdout ?? "").slice(0, 2000),
      stderr: String(error.stderr ?? error.message).slice(0, 2000),
      command,
    };
  }
}

export function extractBinaryDocuments(target, relativePath) {
  const full = join(target, relativePath);
  if (!existsSync(full)) return null;
  if (/\.docx$/i.test(relativePath)) {
    try {
      const xml = execFileSync("unzip", ["-p", full, "word/document.xml"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } catch {
      return null;
    }
  }
  if (/\.pdf$/i.test(relativePath)) {
    try {
      return execFileSync("pdftotext", ["-q", full, "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      try {
        const binary = readFileSync(full, "latin1");
        return (binary.match(/[\t\n\r -~]{40,}/g) ?? []).join("\n");
      } catch {
        return null;
      }
    }
  }
  return null;
}
