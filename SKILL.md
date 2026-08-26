---
name: agent-framework-review
description: Review Agent projects against consistent standards for runtime behavior, permissions, security, evaluation, and observability, then produce an evidence-based remediation report.
version: 1.2.0
triggers: [agent review, agent architecture review, agent standards check, agent security review, agent 架构审查, agent 标准检查, agent 安全评审]
---

# Agent Framework Review

Use this Skill to review the architecture maturity and risks of an existing Agent project. Never treat static scan results as runtime proof; every conclusion must identify its evidence type.

## Workflow

1. Confirm the project scope and applicable profiles: `core` is mandatory; enable `rag`, `workflow`, `skill`, and `browser` when relevant.
2. Read [references/agent-framework-standard.md](references/agent-framework-standard.md) and report findings with standard IDs and risk levels.
3. The output folder is always `<project>/agent-review/` (create it if missing). Run:

   `scripts/review-project.mjs <target-directory>`

   That writes the data report, Excel workbook, and HTML into `agent-review/` and prints a draft to stdout. Treat code, tests, and traces as implementation evidence; use documentation claims for design context only. Later reviews reuse `agent-review/receipt.json` so unchanged files are not re-read. Pass `--full` only when a complete rescan is required.
4. Read the Runtime, Tools, permissions, Session, Trace, tests, and configuration entry points to verify scan findings.
5. Run existing tests only with `--execute-tests` when authorized. If they are not run, keep `partial`/`unknown` where runtime proof is required; never imply a pass from documentation.
6. Point the user to `agent-review/report.html` (browser), `agent-review/report.xlsx` (Excel), and `agent-review/report.md` / `report.json` (data). Use [templates/review-report.md](templates/review-report.md) only if a human narrative is needed on top. In CI, use `--ci --fail-on critical` (CI does not write `agent-review/` unless `--artifacts-dir` is set).

## Constraints

- Do not read `.env`, `agent.config.json`, secrets, or private user directories.
- Do not perform writes, deployments, payments, messaging, deletion, or external publication to complete a review, except creating/updating `<project>/agent-review/`.
- Every not-applicable item must include a reason.
- Report Critical and High gaps before style concerns.
- Documentation never independently produces a pass.
- Comments and unused helpers cannot establish a structural pass.

## Script

- `scripts/review-project.mjs`: review with JSON, Markdown, or SARIF on stdout, and a project-local `agent-review/` bundle (report, Excel, HTML, receipt). Supports `--execute-tests`, `--compare`, `--artifacts-dir`, `--from-receipt`, `--full`, `--no-artifacts`, and `--ci`.
- `scripts/ci-review.mjs`: same entry point with CI defaults (`--ci --format json`).
- `scripts/inspect-project.mjs`: legacy read-only scan that lists matching filenames only.

## Template

- `templates/review-report.md`: use after gathering evidence to write the final architecture review report.

## Acceptance criteria

- The report includes applicable profiles, standard IDs, status, risk level, confidence, and located evidence.
- Every Critical or High gap has an actionable remediation recommendation and acceptance criteria.
- Static scanning, structural analysis, tests, and runtime verification are clearly distinguished.
- The report does not expose sensitive information found during scanning.
- When this Skill is invoked in a project, outputs land in that project's `agent-review/` folder.
