# Agent Framework Review Technical Documentation and Evidence Standard

## Purpose

This standard governs the review tool's design documents, rule documents, test fixtures, and reports. Its purpose is to make every conclusion traceable, reviewable, and repeatable without treating documentation as proof of implementation.

## Documentation hierarchy

| Document | Purpose | Required content |
| --- | --- | --- |
| `README.md` | Installation, invocation, and overview | Purpose, installation prompt, commands, output example, limits |
| `docs/development-plan.md` | Roadmap and phase acceptance | Goals, scope, phases, acceptance criteria, dependencies |
| `references/agent-framework-standard.md` | Normative review standard | ID, risk, profile, passing/failing evidence |
| `docs/rules/<id>.md` | Per-rule documentation | Purpose, detection logic, false-positive boundaries, fixtures, remediation |
| `docs/adr/NNNN-title.md` | Material design decisions | Context, decision, alternatives, consequences |
| `templates/review-report.md` | Report structure | Scope, findings, evidence, risk, recommendations, baseline |

## Standard-item contract

Every review standard has a unique ID, such as `T-02`. Adding or changing a standard requires updates to the standard, rule documentation, fixture, and report guidance.

```markdown
## T-02 Tool Permission and Scope Checks

- Profile: core
- Risk: Critical
- Requirement: Every tool call passes through permission and scope checks.
- Applicability: The project has callable tools or external side effects.
- Static evidence: Permission gate, allowlist, path or domain constraints.
- Structural evidence: The permission gate dominates tool execution with no bypass path.
- Test evidence: Unauthorized and out-of-scope calls are rejected.
- Runtime evidence: The trace records the decision and refusal reason.
- Pass criteria: Structural evidence plus at least test or runtime evidence.
- Common false positives: Comments, unused `authorize()` calls, frontend-only restrictions.
- Remediation and acceptance: ...
```

## Evidence model

```json
{
  "type": "code | test | runtime | configuration | documentation",
  "file": "src/security/permission-gate.ts",
  "line": 42,
  "snippet": "authorize(toolCall, context)",
  "reason": "Tool execution is preceded by authorization",
  "confidence": "high"
}
```

Evidence strength, from strongest to weakest, is `runtime`, `test`, `code`, `configuration`, and `documentation`. Documentation may guide scope and consistency review but cannot independently produce `pass`.

## Status and confidence

| Status | Meaning |
| --- | --- |
| `pass` | Passing criteria are met and evidence supports the conclusion |
| `partial` | Implementation exists but a path, scope, or verification is incomplete |
| `fail` | A required capability is missing or a violation path is confirmed |
| `manual-review` | Automation cannot determine the outcome reliably |
| `not-applicable` | Out of scope, with a recorded rationale |
| `unknown` | Insufficient evidence; do not imply a pass |

- `high` confidence: runtime evidence, or structural analysis plus test evidence.
- `medium` confidence: code implementation plus partial configuration or test support.
- `low` confidence: keyword match, documentation claim, or isolated snippet only.

## Documentation-reading rules

Start a review by reading high-value project documents: `README`, `docs/`, ADRs, `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, schemas, and test/deployment instructions.

Record every document claim with its source, summary, expected code locations, and verification status:

```json
{
  "claim": "All tool calls pass through PermissionGate.",
  "source": "docs/architecture.md:42",
  "expectedCodeAreas": ["src/tools", "src/security"],
  "verification": "pending"
}
```

Documentation/code mismatches are reportable findings:

- Documented but unverified in code: `manual-review` or `partial`.
- Implemented in code but undocumented: maintainability finding.
- Consistent documentation and code: still requires tests or runtime evidence for `pass`.

## Rule and test requirements

Every automated rule needs:

- One `pass` fixture.
- One `fail` fixture.
- One `partial` or bypass fixture.
- Assertions for expected status, risk, and key evidence.
- False-positive guidance, including comments, dead code, and test code.

Rule changes must run all fixtures, not merely the new positive case.

## Report requirements

Every report includes:

- Target project, scan time, commit SHA, and review-tool version.
- Enabled profiles and rationale for non-applicable items.
- Review methods: static scan, documentation, tests, and runtime traces.
- Standard ID, status, risk, confidence, evidence, and remediation for every finding.
- Impact and acceptance criteria for each Critical/High gap.
- Available baselines for success rate, latency, cost, and tool calls.
- Limitations such as tests not run, missing traces, or inaccessible paths.

Reports must not:

- Present document matching as implemented code.
- Make a definitive pass/fail claim without evidence.
- Expose secrets, full sensitive data, or private user content.
- Blend scanner conclusions with reviewer conclusions.

## Change management

- Breaking standard or rule changes require a version increment and ADR.
- A new Critical/High standard requires a fixture and remediation template before release.
- Each release records rule count, standard coverage, false-positive/false-negative samples, duration, and known limitations.
