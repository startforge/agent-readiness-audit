---
name: agent-framework-review
description: Review Agent projects against consistent standards for runtime behavior, permissions, security, evaluation, and observability, then produce an evidence-based remediation report.
version: 1.0.0
triggers: [agent review, agent architecture review, agent standards check, agent security review, agent 架构审查, agent 标准检查, agent 安全评审]
---

# Agent Framework Review

Use this Skill to review the architecture maturity and risks of an existing Agent project. Never treat static scan results as runtime proof; every conclusion must identify its evidence type.

## Workflow

1. Confirm the project scope and applicable profiles: `core` is mandatory; enable `rag`, `workflow`, `skill`, and `browser` when relevant.
2. Read [references/agent-framework-standard.md](references/agent-framework-standard.md) and report findings with standard IDs and risk levels.
3. Run `scripts/inspect-project.mjs <target-directory>` to collect static evidence. Treat `codeEvidence` as candidate implementation only; use `documentationEvidence` for design context only.
4. Read the Runtime, Tools, permissions, Session, Trace, tests, and configuration entry points to verify scan findings.
5. Run existing tests and evaluations only within the authorized scope. If they are not run, use `manual-review`; never imply a pass.
6. Use `templates/review-report.md` to produce the release conclusion, evidence, gaps, and risk-prioritized remediation actions.

## Constraints

- Do not read `.env`, `agent.config.json`, secrets, or private user directories.
- Do not perform writes, deployments, payments, messaging, deletion, or external publication to complete a review.
- Every not-applicable item must include a reason.
- Report Critical and High gaps before style concerns.

## Script

- `scripts/inspect-project.mjs`: read-only scan of TypeScript, JavaScript, Markdown, and JSON files. Run it at the beginning of a review to collect candidate evidence.

## Template

- `templates/review-report.md`: use after gathering evidence to write the final architecture review report.

## Acceptance criteria

- The report includes applicable profiles, standard IDs, status, risk level, and evidence.
- Every Critical or High gap has an actionable remediation recommendation.
- Static scanning, code review, and runtime verification are clearly distinguished.
- The report does not expose sensitive information found during scanning.
