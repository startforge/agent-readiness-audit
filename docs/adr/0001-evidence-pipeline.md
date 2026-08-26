# ADR 0001: Evidence pipeline and documentation-cannot-pass

## Context

The original scanner reported filenames that matched keywords. That is useful for navigation and easy to misread as proof that an Agent is production-ready.

## Decision

Expose one CLI, `scripts/review-project.mjs`. Internally split work into discovery, documentation indexing, evidence collection, rule evaluation, confidence, and reporting. Evidence is a located record (`type`, `file`, `line`, `snippet`, `reason`, `confidence`). Documentation is indexed as claims and consistency findings. It never independently produces `pass`. Missing evidence is `unknown` unless applicability is clear and the capability is required (for example T-02 when tools exist).

## Alternatives

- Keep filename-only keyword output: rejected; findings must be locatable.
- Treat architecture documents as passing evidence: rejected; documents describe intent, not runtime behavior.
- Execute tests and tools during every review: rejected for the default path; reviews are read-only unless separately authorized.

## Consequences

`inspect-project.mjs` remains as a compatibility scanner. After Phase 3, Critical items such as T-02 can `pass` when structural call-chain evidence is backed by tests or traces. Fixture status is the regression signal for rule changes.
