# Agent Framework Review Development Plan

## Objective

Evolve the current keyword-based static scanner into an Agent project review tool that treats code as primary evidence, project documentation as navigation, and tests plus runtime traces as verifiable evidence. Every conclusion must identify its standard ID, status, risk, evidence, confidence, and remediation.

## Design principles

- Code, tests, and runtime traces are implementation evidence; documentation establishes expected design only.
- Missing evidence is not automatically a failure. Use `unknown` or `manual-review` when automation cannot determine the result reliably.
- Every Critical or High conclusion must include file location, evidence type, confidence, and acceptance criteria.
- Expose one simple review entry point; discovery, indexing, rule execution, evidence aggregation, and reporting remain internal.
- Do not read `.env`, secrets, or private directories, and do not execute dangerous external actions.

## Target interface

```bash
node scripts/review-project.mjs <target-directory> \
  --profiles core,rag,workflow \
  --format markdown \
  --output review-report.md
```

The default behavior discovers languages, project documents, tests, and applicable profiles. `core` is always enabled; other profiles may be suggested automatically or selected explicitly.

## Internal modules

| Module | Responsibility | Input | Output |
| --- | --- | --- | --- |
| Project Discovery | Identify language, framework, entry points, tests, configuration, and ignored paths | Project directory | Project manifest and capability profile |
| Documentation Index | Extract architecture claims and expected code locations from high-value documents | Document list | Documentation index and implementation map |
| Evidence Collector | Extract code, configuration, test, and trace evidence | Files and rules | Located, explained evidence |
| Rule Engine | Run static, structural, test, and runtime rules per standard | Evidence and profiles | Candidate status and missing evidence |
| Confidence Engine | Calculate evidence strength and prevent documentation-only passes | Rule result | `high`, `medium`, or `low` confidence |
| Report Builder | Produce JSON and Markdown reports | Aggregated findings | Review report |

Each module has a clear seam. For example, the Rule Engine consumes normalized Evidence rather than reading files directly, allowing language parsers and trace readers to vary without changing rule logic.

## Delivery phases

### Phase 0: baseline and fixtures

- Add `fixtures/` with `pass`, `fail`, and `partial` examples for each standard.
- Add a single local command that asserts expected results for every fixture.
- Record baseline rule count, standard coverage, false-positive samples, false-negative samples, and execution time.
- Preserve compatibility with the existing `inspect-project.mjs` smoke test.

Acceptance: the fixture command runs without network access and becomes red for a real incorrect implementation.

### Phase 1: traceable scan results

- Support `.ts`, `.tsx`, `.js`, `.mjs`, `.py`, `.json`, `.yaml`, `.yml`, `.toml`, `.sh`, and `.md`.
- Emit file, line, snippet, evidence type, and match reason for every finding.
- Distinguish production code, tests, documentation, configuration, and generated files.
- Map every standard ID to an automated rule, a manual check, or an explicit `manual-review` reason.
- Migrate legacy `codeEvidence` and `documentationEvidence` into one Evidence format.

Acceptance: every current standard has a defined check strategy and no finding consists only of a filename.

### Phase 2: documentation-first targeted review

- Index `README`, `docs/`, ADRs, `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, schemas, and test/deployment instructions.
- Extract architecture claims for Agent loops, tools, permissions, data sources, traces, deployment, and tests.
- Record the source and expected code areas for every claim.
- Report documentation/code mismatches.
- Optionally extract `.docx` and `.pdf` text; it is always `documentation` evidence and never sufficient for `pass`.

Acceptance: projects with architecture documents yield an implementation map and explicit documentation/code consistency findings.

### Phase 3: structural and call-chain verification

- Add AST analysis for TS/JS and Python.
- Identify tool registration, model-output parsing, permission gates, approval gates, executors, and trace writers.
- Verify the critical path: `model output → schema validation → permission check → confirmation → tool execution → trace`.
- Prioritize R-02, R-03, T-02, T-03, and O-03.
- Detect bypass paths such as direct dangerous-tool execution or unrestricted file writes.

Acceptance: pass, fail, and bypass fixtures produce correct results; comments and dead code cannot establish a pass.

### Phase 4: tests, evaluations, and runtime evidence

- Discover test commands from project manifests and CI configuration; execute only with authorization.
- Import JSONL, OpenTelemetry exports, or application traces.
- Record success rate, p50/p95 latency, token/cost, tool-call count, and failure classification.
- Add security fixtures for prompt injection, unauthorized tools, dangerous-action rejection, and log disclosure.
- Critical and High items cannot pass solely from keyword matches when runtime evidence is absent.

Acceptance: at least one integration fixture verifies permission rejection, approval gating, and trace correlation.

### Phase 5: reporting, CI, and quality governance

- Output JSON and Markdown; optionally SARIF.
- Compare findings with a previous report.
- Include rule version, scan time, project commit SHA, profiles, and evidence summary.
- Provide a read-only CI command with configurable failure thresholds.
- Track rule coverage, false positives, false negatives, manual-review ratio, and duration.

Acceptance: CI can block a new Critical failure and reports can locate evidence and acceptance actions.

## Priority order

1. Phases 0 and 1: reliable feedback and traceable evidence.
2. Phase 2: documentation indexing to reduce review cost.
3. Phase 3: structural analysis for security accuracy.
4. Phase 4: runtime evidence for verifiable conclusions.
5. Phase 5: CI and trend governance.

## Definition of done

- Every standard has a check strategy and evidence requirement.
- Documentation alone never establishes an implementation pass.
- Every Critical/High finding is locatable and has acceptance criteria.
- Fixtures cover typical false positives, false negatives, and permission bypasses.
- Reports distinguish static, test, and runtime conclusions.
