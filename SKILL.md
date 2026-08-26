---
name: agent-framework-review
description: Review Agent projects against consistent standards for runtime behavior, permissions, security, evaluation, and observability, then produce an evidence-based remediation report.
version: 1.1.0
triggers: [agent review, agent architecture review, agent standards check, agent security review, agent 架构审查, agent 标准检查, agent 安全评审]
---

# Agent Framework Review

Use this Skill to review the architecture maturity and risks of an existing Agent project. Never treat static scan results as runtime proof; every conclusion must identify its evidence type.

## Workflow

1. Confirm the project scope and applicable profiles: `core` is mandatory; enable `rag`, `workflow`, `skill`, and `browser` when relevant.
2. Read [references/agent-framework-standard.md](references/agent-framework-standard.md) and report findings with standard IDs and risk levels.
3. Run `scripts/review-project.mjs <target-directory> --format markdown` to collect located evidence, structural call-chain results, imported traces, and a draft report. Treat code, tests, and traces as implementation evidence; use documentation claims for design context only.
4. Read the Runtime, Tools, permissions, Session, Trace, tests, and configuration entry points to verify scan findings.
5. Run existing tests only with `--execute-tests` when authorized. If they are not run, keep `partial`/`unknown` where runtime proof is required; never imply a pass from documentation.
6. Use [templates/review-report.md](templates/review-report.md) to produce the release conclusion, evidence, gaps, and risk-prioritized remediation actions. In CI, use `--ci --fail-on critical` and optionally `--format sarif` or `--compare previous.json`.

## Constraints

- Do not read `.env`, `agent.config.json`, secrets, or private user directories.
- Do not perform writes, deployments, payments, messaging, deletion, or external publication to complete a review.
- Every not-applicable item must include a reason.
- Report Critical and High gaps before style concerns.
- Documentation never independently produces a pass.
- Comments and unused helpers cannot establish a structural pass.

## Script

- `scripts/review-project.mjs`: read-only review with JSON, Markdown, or SARIF output. Supports `--execute-tests`, `--compare`, and `--ci`.
- `scripts/ci-review.mjs`: same entry point with CI defaults (`--ci --format json`).
- `scripts/inspect-project.mjs`: legacy read-only scan that lists matching filenames only.

## Template

- `templates/review-report.md`: use after gathering evidence to write the final architecture review report.

## Acceptance criteria

- The report includes applicable profiles, standard IDs, status, risk level, confidence, and located evidence.
- Every Critical or High gap has an actionable remediation recommendation and acceptance criteria.
- Static scanning, structural analysis, tests, and runtime verification are clearly distinguished.
- The report does not expose sensitive information found during scanning.
