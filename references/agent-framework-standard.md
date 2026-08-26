# Agent Framework Engineering Standard

This standard reviews existing Agent projects. It defines minimum and recommended requirements, evidence types, and risk levels without prescribing a single framework, model, or deployment platform.

## Rules of use

- `MUST`: required when applicable; otherwise the project cannot be considered to possess the capability.
- `SHOULD`: strongly recommended; a gap may not block release but requires a recorded risk or plan.
- `N/A`: outside the project scope; it requires a scope rationale and must not conceal a missing capability.
- Every item needs code, test, trace, configuration, or runtime-result evidence.
- Static scanning only finds possible implementations. Final conclusions require code review and runtime evidence.

## Risk levels

| Level | Meaning | Required action |
| --- | --- | --- |
| Critical | Can cause unauthorized access, data disclosure, irreversible external action, or unbounded cost | Fix before release |
| High | A task may become uncontrolled, unrecoverable, or impossible to verify | Fix before core functionality release |
| Medium | Quality, stability, or diagnosability is insufficient | Add to remediation plan |
| Low | Maintainability, documentation, or usability improvement | Prioritize as appropriate |

## Core profile: all Agents

| ID | Risk | Requirement | Passing evidence |
| --- | --- | --- | --- |
| R-01 | High | An explicit Agent loop separates model decisions from external execution. | Runtime/loop code and structured decision types. |
| R-02 | High | Model output or tool intent is schema-validated. | JSON Schema, Zod, TypeScript guard, or parse-failure handling. |
| R-03 | High | Each run has a maximum step count, duration, or call budget. | `maxSteps`, timeout, budget, loop guard, and tests. |
| R-04 | Medium | Task state is persistent or the design explicitly declares statelessness. | Session/TaskState, state transitions, or stateless design documentation. |
| R-05 | Medium | Context has a length/token budget and truncation strategy. | Context builder, compaction, or context limit. |
| T-01 | High | Tool input, output, and error boundaries are explicit. | Tool schema, result types, and error transformation. |
| T-02 | Critical | Tool calls have permission and scope checks. | Permission gate, allowlist, workspace/domain constraints. |
| T-03 | Critical | Dangerous actions such as deletion, payment, publishing, or sending messages require confirmation. | Approval gate, confirmation record, and refusal path. |
| O-01 | Medium | Every run has a trace correlated to run/session/task. | JSONL, OTel, log events, and IDs. |
| O-02 | Medium | Call count, latency, token/cost, or explicit cost-unavailable state is recorded. | Metrics collection and report. |
| O-03 | High | Logs, traces, and errors do not expose keys, passwords, or complete sensitive data. | Redaction/filter and tests. |
| E-01 | High | Fixed evaluations or regression tests exist; manual demos alone are insufficient. | Repeatable test suite, expected results, and command. |
| E-02 | Medium | Failures can be attributed to Prompt, Tool, Retrieval, Model, State, Safety, or similar category. | Failure category and trace comparison. |
| S-01 | High | Prompt injection, data exfiltration, and tool abuse are tested or input sources are explicitly constrained. | Risk policy, tool parameter limits, and tests. |

## RAG profile: private knowledge bases

| ID | Risk | Requirement | Passing evidence |
| --- | --- | --- | --- |
| K-01 | Medium | Chunks have stable IDs, sources, and locations. | Chunk schema and index example. |
| K-02 | High | Query and documents use compatible embeddings with failure handling. | Embedding adapter, model configuration, and error handling. |
| K-03 | Medium | Retrieval records top-K, similarity, or recall evidence. | Retriever output and trace. |
| K-04 | High | Context construction deduplicates, truncates, and prevents unsupported answers. | Context builder, prompt, and tests. |
| K-05 | Medium | Indexes support version identification, rebuild, or cache invalidation. | Index metadata, cache version, or rebuild command. |

## Workflow profile: multi-Agent or complex flows

| ID | Risk | Requirement | Passing evidence |
| --- | --- | --- | --- |
| W-01 | High | Each role has one responsibility and an input/output schema. | Planner/Writer/Reviewer types and interfaces. |
| W-02 | High | The task goal is explicitly propagated and task drift is checked. | `goal`, topic validation, or reviewer goal input. |
| W-03 | High | Observable stop conditions, maximum rework count, and loop detection exist. | Graph router, revision limit, or loop guard. |
| W-04 | Medium | Reviewer/Critic does not directly modify output; rework uses explicit feedback to the executor. | Review result type and revision path. |

## Skill profile: projects using Skills

| ID | Risk | Requirement | Passing evidence |
| --- | --- | --- | --- |
| SK-01 | Medium | A Skill has a name, purpose, triggers, steps, and acceptance criteria. | `SKILL.md`. |
| SK-02 | High | Skill scripts, templates, and reference resources load on demand. | Registry/loader and resource paths. |
| SK-03 | Critical | A Skill cannot bypass tool permissions, workspace limits, or secret protections. | Execution through Runtime/PermissionGate. |
| SK-04 | Medium | A Skill has a smoke test or task-success evidence. | Test command and result. |

## Browser/computer-use profile

| ID | Risk | Requirement | Passing evidence |
| --- | --- | --- | --- |
| B-01 | High | Observe before each action, then observe and verify afterward. | DOM/screenshot evidence and state machine. |
| B-02 | Critical | Domain, login, payment, download, and form submission have safety constraints. | Browser policy and human confirmation. |
| B-03 | Medium | Loading failures, locator failures, page changes, and dialogs are handled. | Timeout/retry/error state/tests. |
| B-04 | Medium | DOM, screenshots, action logs, and final verification evidence are retained. | Artifact paths and trace. |

## Scoring and release threshold

Mark every item as `pass`, `fail`, `partial`, `not-applicable`, or `manual-review`.

- Any applicable Critical `fail`: do not recommend release.
- Any applicable High `fail`: do not claim production readiness.
- When all Core High requirements pass and fixed evaluations exist: eligible for a controlled pilot.
- No universal thresholds exist for success rate, cost, or latency; define business targets and record the baseline in the report.

## Minimum remediation order

```text
1. Critical: permissions, confirmation, secrets, and sensitive data
2. High: structured output, stop conditions, tool boundaries, and evaluation
3. Medium: session, context, trace, and failure classification
4. Low: documentation, naming, and report readability
```
