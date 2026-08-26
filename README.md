# Agent Framework Review

<p align="right"><a href="README.zh-CN.md">中文</a></p>

This Codex Skill reviews the maturity and risks of Agent projects. It applies consistent standards for runtime behavior, tools, permissions, security, evaluation, observability, and optional capabilities, then produces an evidence-based architecture review report.

## Features

- Select applicable profiles: `core`, `rag`, `workflow`, `skill`, and `browser`
- Organize findings with standard IDs such as `R-01`, `T-02`, and `O-03`
- Collect candidate code evidence through a read-only static scan
- Summarize status, risk level, evidence, metrics, and remediation priorities with a report template
- Distinguish static scanning, code review, tests, and runtime traces; a pattern match is never proof of runtime readiness

## Project layout

```text
.
├── SKILL.md                               # Skill definition and operating rules
├── references/agent-framework-standard.md # Review standards and IDs
├── scripts/inspect-project.mjs             # Read-only static scanner
├── templates/review-report.md              # Review report template
├── smoke-test.mjs                           # Basic acceptance test
└── README.zh-CN.md                          # Chinese documentation
```

## Usage

Run the static scan against an Agent project:

```bash
node scripts/inspect-project.mjs <target-directory>
```

The script prints JSON containing the number of scanned files plus `codeEvidence` and `documentationEvidence` for each standard. `codeEvidence` indicates a possible implementation and must be verified through code review and runtime checks; `documentationEvidence` is for design context only. The scanner skips `.env`, `agent.config.json`, `.git`, build artifacts, and common data directories.

Use `templates/review-report.md` for the final report. Include applicable profiles, standard IDs, status, risk level, evidence type, and actionable remediation for Critical/High gaps.

## Smoke test

```bash
node smoke-test.mjs
```

The smoke test checks baseline evaluation and observability evidence. Before running it, make sure the configured target directory exists: `stage7-eval-observability`.

## Safety boundaries

This Skill is for review only. Do not perform writes, deployments, payments, messaging, deletion, or external publication as part of a review. Do not expose secrets or private user data. Address Critical/High risks before style issues.
