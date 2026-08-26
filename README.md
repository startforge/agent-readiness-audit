# Agent Framework Review

**Website:** [https://startforge.github.io/agent-readiness-audit/](https://startforge.github.io/agent-readiness-audit/)

An evidence-based architecture review for Agent projects. It checks runtime behavior, tools, permissions, security, evaluation, and observability against a shared standard, then writes a report you can act on.

The scanner locates implementation evidence in code, tests, and traces. Architecture documents help it know where to look; they never independently produce a `pass`. A keyword match is never proof that the Agent is ready to run in production. When you run it in a project, it writes a bundle to that project's `agent-review/` folder (data report, Excel, HTML). `--ci` stays read-only unless you pass `--artifacts-dir`.

Current release: **1.2.0**. Requires **Node.js 20+**. No extra npm packages.

## Contents

- [Website](https://startforge.github.io/agent-readiness-audit/)
- [What it is for](#what-it-is-for)
- [Quick start with Codex](#quick-start-with-codex)
- [Quick start from the CLI](#quick-start-from-the-cli)
- [What a review actually does](#what-a-review-actually-does)
- [CLI reference](#cli-reference)
- [Review artifacts and incremental scans](#review-artifacts-and-incremental-scans)
- [How to read a report](#how-to-read-a-report)
- [Profiles and standards](#profiles-and-standards)
- [Evidence, status, and confidence](#evidence-status-and-confidence)
- [CI](#ci)
- [Fixtures](#fixtures)
- [Project layout](#project-layout)
- [Tests](#tests)
- [Safety](#safety)
- [Further reading](#further-reading)

## What it is for

Use this Skill when you need a consistent architecture review of an existing Agent, not a greenfield design. Typical questions it answers:

- Do tool calls go through a permission gate, or can they bypass it?
- Is model output schema-validated before anything runs?
- Is there a step/time/cost budget, or can a loop run forever?
- Do delete / pay / publish / message actions require confirmation?
- Are logs and traces redacting secrets?
- Are there repeatable tests, or only a demo?

It does **not** pick a framework, model vendor, or cloud. The same IDs (`T-02`, `R-02`, `O-03`, …) apply whether the runtime is TypeScript, Python, or a mix.

## Quick start with Codex

Copy this repository URL and give Codex:

```text
Please install this Codex Skill from:
https://github.com/startforge/agent-readiness-audit.git

After installation, use the agent-framework-review Skill to review the code in the current project. Run the static inspection, read the relevant implementation, distinguish static evidence from runtime verification, and generate a complete review report using the repository template.
```

After the Skill is installed, in the Agent project:

```text
Use agent-framework-review to review the current Agent project and generate an evidence-based architecture review report.
```

The Skill should:

1. Confirm scope and profiles (`core` is mandatory).
2. Run `scripts/review-project.mjs` on the current project so outputs go to `agent-review/`.
3. Read runtime, tools, permissions, traces, and tests to verify the scan.
4. Point you to `agent-review/report.html`, `agent-review/report.xlsx`, and `agent-review/report.md`.

## Quick start from the CLI

Clone this repository (or use it as an installed Skill) and point it at an Agent project:

```bash
node scripts/review-project.mjs /path/to/agent
```

Open `/path/to/agent/agent-review/report.html` in a browser, or `/path/to/agent/agent-review/report.xlsx` in Excel.

Try it on a bundled fixture first (add `--no-artifacts` if you do not want a folder written into the fixture):

```bash
node scripts/review-project.mjs fixtures/core-permission-pass --profiles core --format markdown
node scripts/review-project.mjs fixtures/core-integration-pass --profiles core --format json
```

`core` is always enabled. If you omit `--profiles`, the tool suggests `rag`, `workflow`, `skill`, and `browser` when it sees matching evidence.

## What a review actually does

One command drives an internal pipeline. Callers should not need the internals; this is what happens:

| Stage | What it does |
| --- | --- |
| Discovery | Walks the target tree, classifies files (code, test, docs, config, traces), detects languages and capabilities, suggests profiles. Skips `.git`, `node_modules`, build output, `.env`, `agent.config.json`, and other secret-like files. |
| Documentation index | Reads high-value docs (`README`, `docs/`, ADRs, `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, schema files). Records architecture claims and expected code areas. Optional `.docx` / `.pdf` text is documentation only. |
| Evidence collection | Matches rules with file, line, snippet, type, and reason. Comments are ignored. |
| Structural analysis | Parses JS/TS and Python into functions and calls. Checks that permission, schema, budget, approval, and redaction actually sit on the tool path. Unused helpers and comment-only gates cannot pass. |
| Traces | Imports `*.jsonl` and OpenTelemetry-style JSON. Derives success rate, p50/p95 latency, cost, and tool-call counts when those fields exist. |
| Rule engine | Assigns status, risk, and confidence per standard. Documentation never independently produces `pass`. |
| Report | Writes Markdown, JSON, or SARIF, including release conclusion, limitations, and (optionally) a diff against a previous JSON report. |

Default reviews **do not** run the target’s tests, tools, or deploys. Pass `--execute-tests` only when that is authorized.

Supported source and config extensions: `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.py`, `.json`, `.yaml`, `.yml`, `.toml`, `.sh`, `.md`, `.jsonl`, plus optional `.docx` / `.pdf`.

## CLI reference

```text
node scripts/review-project.mjs <target-directory> [options]
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--profiles core,rag,…` | auto-detect (`core` always on) | Which standard groups to evaluate. Unknown names are rejected. |
| `--format markdown\|json\|sarif` | `markdown` | stdout format. JSON is the machine-readable record; SARIF is 2.1.0. |
| `--output file` | none | Also write the same payload to a file. |
| `--compare previous.json` | none | Diff finding status against a previous JSON report. |
| `--artifacts-dir dir` | `<target>/agent-review` | Project-local output folder for reports, Excel, HTML, and the receipt. |
| `--from-receipt path` | the artifacts dir, if present | Incremental review from `receipt.json` or an artifacts directory. |
| `--full` | off | Ignore any receipt and rescan every file. |
| `--no-artifacts` | off | Do not write the `agent-review/` bundle. |
| `--execute-tests` | off | Run the first discovered test command (`package.json` `test`, pytest, or a test file). |
| `--ci` | off | Exit `1` when the failure threshold is breached. |
| `--fail-on critical,high` | `critical` | Used with `--ci`. `critical` blocks Critical `fail`; add `high` or `partial` to tighten. |
| `--help` | | Print usage. |

Helpers:

```bash
node scripts/ci-review.mjs <target-directory>     # same as review with --ci --format json
node scripts/inspect-project.mjs <target-directory>  # legacy filename-only scan
```

The legacy inspector still prints `codeEvidence` and `documentationEvidence` lists. Treat those as navigation hints, not as a pass/fail decision.

### Useful combinations

```bash
# Human-readable draft
node scripts/review-project.mjs . --format markdown --output review-report.md

# Machine record for later comparison
node scripts/review-project.mjs . --format json --output review.json

# Trend: what changed since last week
node scripts/review-project.mjs . --format json --compare last-week.json --output review.json

# CI gate (no test execution)
node scripts/review-project.mjs . --ci --fail-on critical --format json --output review.json

# Authorized test run plus traces already in the repo
node scripts/review-project.mjs . --execute-tests --format markdown

# Persist explicitly (same as the default folder)
node scripts/review-project.mjs . --artifacts-dir agent-review

# Later review: reuse unchanged files from the receipt
node scripts/review-project.mjs . --from-receipt agent-review

# Stdout only (no project folder)
node scripts/review-project.mjs . --no-artifacts --format markdown
```

## Review artifacts and incremental scans

When this Skill is invoked in a project, or when you run the CLI without `--ci` / `--no-artifacts`, it creates **`<project>/agent-review/`** if needed and writes the bundle there. That directory is skipped on later walks, so the bundle is not scanned as project source.

| File | Role |
| --- | --- |
| `report.html` | Final HTML: findings, hierarchy, file mapping, relationships. Open in a browser. |
| `report.xlsx` | Excel workbook: Summary, Findings, Files, Hierarchy, Relationships, Evidence. |
| `report.md` / `report.json` | Data reports (Markdown and machine-readable JSON). |
| `map.html` / `map.json` | File mapping table (HTML and JSON). |
| `receipt.json` | Input for the next review: fingerprints, functions, evidence. No full source. |

The next review compares fingerprints and **reuses** unchanged files instead of re-reading their text. Changed, added, or removed files are rescanned. If `ruleVersion` on the receipt does not match the current reviewer, the scan is full. `--full` forces a full rescan. Unchanged findings from the receipt are also used as the `--compare` baseline when you do not pass `--compare` yourself.

JSON reports always include `fileMap` and `incremental` (`reusedFiles`, `rescannedFiles`, `addedFiles`, `removedFiles`), even when you do not write artifacts.

## How to read a report

Every report includes:

- Target path, scan time, commit SHA (when git is available), tool version, and rule version
- Enabled profiles and why other profiles were skipped
- Evidence methods used (`static-scan`, `documentation`, `structural`, `runtime-traces`, optionally `executed-tests`)
- A **release conclusion**: `blocked`, `conditional`, or `ready-for-pilot`
- One row per applicable standard: ID, status, risk, confidence, evidence, remediation
- Documentation claims and whether they match code
- Metric baseline when traces exist (success rate, latency, cost, tool calls)
- File mapping and hierarchy (which files sit in runtime, tools, security, tests, and so on)
- Incremental scan stats when a receipt was reused
- Limitations (tests not run, traces missing, and so on)

### Release conclusion

| Status | When |
| --- | --- |
| `blocked` | An applicable **Critical** item is `fail` (permissions, confirmation, skill bypass, browser safety). Do not recommend release. |
| `conditional` | No Critical fail, but High items are incomplete or failing. Do not claim production readiness. |
| `ready-for-pilot` | Core High (and Critical) items `pass` and a repeatable eval/test exists (`E-01`). |

There is no universal numeric bar for success rate or cost. Record the observed baseline in the report and compare it to your own targets.

### Finding example

A JSON finding looks like:

```json
{
  "id": "T-02",
  "status": "pass",
  "risk": "Critical",
  "confidence": "high",
  "evidence": [
    {
      "type": "code",
      "file": "src/tools.mjs",
      "line": 6,
      "snippet": "if (!authorize(toolCall)) throw new Error(\"unauthorized\");",
      "reason": "Tool executor calls a permission gate (call chain)"
    }
  ],
  "rationale": "Structural call-chain evidence is backed by tests.",
  "remediation": "",
  "acceptanceCriteria": "Unauthorized and out-of-scope calls are rejected; traces record allow/deny; no bypass path exists around the gate."
}
```

Critical and High gaps always include a file location, evidence type, confidence, remediation, and acceptance criteria. Use [templates/review-report.md](templates/review-report.md) if a human reviewer is writing the final narrative on top of the scanner output.

## Profiles and standards

Normative definitions live in [references/agent-framework-standard.md](references/agent-framework-standard.md). Detection notes live in [docs/rules/](docs/rules/).

| Profile | When to enable | IDs |
| --- | --- | --- |
| `core` | Always | R-01…R-05, T-01…T-03, O-01…O-03, E-01, E-02, S-01 |
| `rag` | Private knowledge / retrieval | K-01…K-05 |
| `workflow` | Multi-agent or graph flows | W-01…W-04 |
| `skill` | Skill files and loaders | SK-01…SK-04 |
| `browser` | Browser or computer-use | B-01…B-04 |

### Core (always on)

| ID | Risk | Requirement |
| --- | --- | --- |
| R-01 | High | Explicit Agent loop: model decisions are not side effects. |
| R-02 | High | Model output / tool intent is schema-validated. |
| R-03 | High | Max steps, duration, or call budget. |
| R-04 | Medium | Persistent task state, or an explicit stateless design. |
| R-05 | Medium | Context length/token budget and truncation. |
| T-01 | High | Tool input, output, and error boundaries. |
| T-02 | Critical | Permission and scope checks on every tool call. |
| T-03 | Critical | Confirmation for delete, pay, publish, or messaging. |
| O-01 | Medium | Per-run trace correlated to run/session/task. |
| O-02 | Medium | Latency, token/cost, or an explicit cost-unavailable marker. |
| O-03 | High | Logs/traces do not expose secrets or full sensitive payloads. |
| E-01 | High | Repeatable tests or evals; demos are not enough. |
| E-02 | Medium | Failures classified (Prompt, Tool, Retrieval, Model, State, Safety, …). |
| S-01 | High | Prompt injection, exfiltration, or tool-abuse tests (or constrained inputs). |

Priority for fixes: Critical (permissions, confirmation, secrets) → High (schema, stop conditions, tool contracts, evals) → Medium (session, context, traces) → Low (docs and naming).

## Evidence, status, and confidence

Strength, strongest first: **runtime → test → code → configuration → documentation**.

| Status | Meaning |
| --- | --- |
| `pass` | Pass criteria are met with implementation evidence (not docs alone). For T-02 / T-03 / R-02 / R-03 / O-03 that means a **call-chain** result plus tests or traces. |
| `partial` | Something exists, but a path, test, or runtime check is missing. |
| `fail` | A required capability is missing, or a bypass/leak was confirmed. |
| `unknown` | Not enough evidence. Absence of keywords is not treated as a confirmed failure. |
| `manual-review` | Automation cannot decide reliably. |
| `not-applicable` | Out of scope, with a recorded reason (for example T-03 when no dangerous actions exist). |

| Confidence | Typical backing |
| --- | --- |
| `high` | Runtime traces, or structural analysis plus tests. |
| `medium` | Production code plus tests or configuration. |
| `low` | Keyword match, isolated snippet, or documentation only. |

Rules that matter for security:

- Documentation cannot independently produce `pass`.
- Comments and dead code cannot establish a structural pass.
- Critical/High items cannot pass from keyword matches alone.
- Missing evidence is `unknown` unless the capability is clearly applicable and required (for example tools exist but T-02 has no gate → `fail`).

## CI

This repository’s workflow runs `npm test`, then reviews the integration fixture with a Critical gate:

```yaml
- run: npm test
- run: node scripts/review-project.mjs fixtures/core-integration-pass --profiles core --format json --ci --fail-on critical
```

For your own Agent repo, store the JSON report and fail the job on new Critical issues:

```bash
node scripts/review-project.mjs . --format json --output review.json --ci --fail-on critical --compare previous.json
```

`--ci` does not write `agent-review/` unless you also pass `--artifacts-dir`. It does not deploy, pay, or message.

## Fixtures

`fixtures/` is the regression pack. `node test/fixtures.test.mjs` asserts each directory’s `expected.json` with no network access.

| Fixture | What it proves |
| --- | --- |
| `core-permission-pass` | T-02 `pass`: executor calls `authorize`, unauthorized call is tested. |
| `core-permission-partial` | T-02 `partial`: gate exists, no tests. |
| `core-permission-fail` | T-02 `fail`: tools with no gate. |
| `core-permission-bypass` | T-02 `fail`: `authorize` exists but is not called. |
| `core-permission-comment` | T-02 `fail`: gate only in a comment. |
| `core-permission-py` | Same as pass, via Python AST. |
| `core-schema-pass` / `fail` / `partial` | R-02 parse-before-execute vs raw model output vs unused `JSON.parse`. |
| `core-budget-pass` / `fail` | R-03 `maxSteps` loop vs unbounded `while (true)`. |
| `core-approval-pass` / `fail` / `bypass` | T-03 confirmation on `deleteFile`. |
| `core-redact-pass` / `fail` | O-03 redaction vs logging `apiKey`. |
| `core-security-injection` | S-01 prompt-injection test. |
| `core-integration-pass` | Permission denial, approval gating, and correlated JSONL traces together. |

When this repository itself is the scan target, `fixtures/` is skipped so sample Agents do not pollute the Skill’s own review.

## Project layout

```text
.
├── SKILL.md                               Skill definition and operating rules
├── references/agent-framework-standard.md Normative review standard and IDs
├── scripts/review-project.mjs             Review entry point
├── scripts/ci-review.mjs                  CI wrapper (--ci --format json)
├── scripts/inspect-project.mjs            Legacy filename-only scanner
├── lib/                                   Discovery, AST, evidence, rules, reporting
├── templates/review-report.md             Human report template
├── fixtures/                              Pass, fail, partial, bypass, and integration examples
├── test/                                  Fixture, reporting, and CLI tests
├── smoke-test.mjs                         Legacy-scanner smoke test
├── docs/development-plan.md               Roadmap and phase acceptance
├── docs/technical-documentation-standard.md Evidence and documentation contract
├── docs/rules/                            Per-rule detection notes
├── docs/adr/                              Design decisions
└── docs/baseline.json                     Rule count, coverage, known limitations
```

## Tests

```bash
npm test
```

Equivalent:

```bash
node test/review-project.test.mjs   # T-02 pass fixture + README claims
node test/fixtures.test.mjs         # every fixtures/*/expected.json
node test/reporting.test.mjs        # SARIF, CI exit codes, --compare, artifacts, incremental
node smoke-test.mjs                 # inspect-project.mjs still works on this repo
```

All of these run offline. The smoke test scans this repository with the legacy inspector and checks that evaluation and observability keywords still resolve.

## Safety

This Skill is for review only.

- Do not read `.env`, `agent.config.json`, private keys, or credential files.
- Do not perform writes, deployments, payments, messaging, deletion, or external publication as part of a review, except the project's `agent-review/` bundle.
- Do not paste secrets or raw personal data into the report; snippets are redacted when they look like keys or passwords.
- Address Critical and High gaps before style or naming.

## Further reading

- [references/agent-framework-standard.md](references/agent-framework-standard.md) — requirements, risk, and pass evidence
- [docs/technical-documentation-standard.md](docs/technical-documentation-standard.md) — evidence model and report contract
- [docs/development-plan.md](docs/development-plan.md) — phases 0–5 and definition of done
- [docs/rules/](docs/rules/) — how each automated rule detects pass/fail
- [docs/adr/](docs/adr/) — why documentation cannot pass, and why structural analysis plus CI exist
- [templates/review-report.md](templates/review-report.md) — narrative report shape
