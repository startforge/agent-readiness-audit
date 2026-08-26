# Rule catalog

Every review standard has an automated check strategy, a manual-review reason, or both. Per-rule details for T-02 live in [T-02.md](T-02.md). Remaining IDs follow the contract in `references/agent-framework-standard.md` and `lib/standards.mjs`.

## Core

| ID | Risk | Strategy | Pass bar used by the scanner |
| --- | --- | --- | --- |
| R-01 | High | automated | Code plus tests is `partial` until runtime evidence exists |
| R-02 | High | automated | Schema validation; High items stay `partial` without runtime/structural proof |
| R-03 | High | automated | `maxSteps` / timeout / budget |
| R-04 | Medium | automated | Session/state or documented statelessness (docs cannot pass alone) |
| R-05 | Medium | automated | Context budget or truncation |
| T-01 | High | automated | Tool schema and error boundaries |
| T-02 | Critical | automated | See [T-02.md](T-02.md) |
| T-03 | Critical | automated | Approval gate when dangerous actions exist |
| O-01 | Medium | automated | Correlated traces |
| O-02 | Medium | automated | Latency, cost, or usage |
| O-03 | High | automated | Redaction plus tests preferred |
| E-01 | High | automated | Repeatable tests or evals |
| E-02 | Medium | automated | Failure taxonomy |
| S-01 | High | automated | Injection / exfiltration / tool-abuse coverage |

## Other profiles

RAG (`K-01`–`K-05`), workflow (`W-01`–`W-04`), skill (`SK-01`–`SK-04`), and browser (`B-01`–`B-04`) rules run only when that profile is enabled or suggested. Critical items SK-03 and B-02 use the same “no documentation-only pass” rule as T-02.

## Fixture policy

Fixtures cover pass/fail/partial/bypass for T-02, R-02, R-03, T-03, and O-03, plus Python AST, injection, and `core-integration-pass`.

Rule changes must run `node test/fixtures.test.mjs`, not only a new positive case. Comments, dead code, and test files cannot establish a production `pass`.
