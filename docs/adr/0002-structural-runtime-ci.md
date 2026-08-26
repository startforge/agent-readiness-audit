# ADR 0002: Structural analysis, runtime traces, and CI gates

## Context

Phase 0–2 could locate keyword evidence but could not prove that a permission helper dominated tool execution. Critical items stayed `partial` even with tests. CI had no machine-readable failure signal.

## Decision

- Parse JS/TS and Python into function/call graphs without extra packages. Comments are stripped before analysis; unused helpers cannot pass.
- Allow Critical/High `pass` when structural evidence is backed by tests or imported runtime traces, not from keywords alone.
- Import JSONL and OpenTelemetry-style traces for metrics and runtime evidence.
- Execute tests only with `--execute-tests`.
- Emit SARIF, compare with a previous JSON report, and support `--ci --fail-on critical` so a new Critical `fail` can block a pipeline.

## Consequences

`fixtures/core-permission-pass` is now `pass` for T-02. Rule version is 1.1.0. Default reviews remain read-only.
