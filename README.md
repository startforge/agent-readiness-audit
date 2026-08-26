# Agent Framework Review

## 中文说明

这是一个用于审查 Agent 工程成熟度与风险的 Codex Skill。它按照统一的运行时、工具、权限、安全、评测、可观测性和专项能力标准，帮助输出有证据的架构审查报告。

### 功能

- 根据工程能力选择适用 Profile：`core`、`rag`、`workflow`、`skill`、`browser`
- 使用标准 ID（例如 `R-01`、`T-02`、`O-03`）整理审查结论
- 通过只读静态扫描收集候选代码证据
- 使用报告模板汇总状态、风险等级、证据、指标和整改优先级
- 明确区分静态扫描、代码阅读、测试和运行 Trace，避免把匹配结果误判为运行时通过

### 目录

```text
.
├── SKILL.md                              # Skill 定义与执行规则
├── references/agent-framework-standard.md # 审查标准与标准 ID
├── scripts/inspect-project.mjs            # 只读静态扫描脚本
├── templates/review-report.md              # 审查报告模板
└── smoke-test.mjs                          # 基础验收测试
```

### 使用

在目标 Agent 工程目录运行静态扫描：

```bash
node scripts/inspect-project.mjs <target-directory>
```

脚本会输出 JSON，包含扫描文件数量、各标准项的 `codeEvidence` 和 `documentationEvidence`。其中：

- `codeEvidence` 仅表示可能存在实现，需要结合代码阅读和运行验证
- `documentationEvidence` 只能帮助理解设计，不能作为通过依据
- 脚本不会读取 `.env`、`agent.config.json`、`.git`、构建产物或常见数据目录

使用 `templates/review-report.md` 编写最终报告。报告至少应包含适用 Profile、标准 ID、状态、风险等级、证据类型，以及 Critical/High 缺口的可执行整改建议。

### Smoke test

```bash
node smoke-test.mjs
```

Smoke test 会验证扫描器能够发现最低限度的评测和可观测性候选证据。运行前请确认测试脚本中配置的目标目录存在：`stage7-eval-observability`。

### 安全边界

该 Skill 仅用于审查，不应为了完成审查而执行写操作、部署、付款、发信、删除或外部发布。审查过程中不要泄露密钥或用户私密信息；Critical/High 风险项应优先于代码风格问题处理。

## English Description

This Codex Skill reviews the maturity and risks of Agent projects. It applies a consistent set of standards for runtime behavior, tools, permissions, security, evaluation, observability, and optional capabilities, then produces an evidence-based architecture review report.

### Features

- Select applicable profiles: `core`, `rag`, `workflow`, `skill`, and `browser`
- Organize findings with standard IDs such as `R-01`, `T-02`, and `O-03`
- Collect candidate code evidence through a read-only static scan
- Summarize status, risk level, evidence, metrics, and remediation priorities with a report template
- Clearly distinguish static scanning, code review, tests, and runtime traces; a pattern match is never treated as proof of runtime readiness

### Project layout

```text
.
├── SKILL.md                              # Skill definition and operating rules
├── references/agent-framework-standard.md # Review standards and IDs
├── scripts/inspect-project.mjs            # Read-only static scanner
├── templates/review-report.md              # Review report template
└── smoke-test.mjs                          # Basic acceptance test
```

### Usage

Run the static scan against an Agent project:

```bash
node scripts/inspect-project.mjs <target-directory>
```

The script prints JSON containing the number of scanned files plus `codeEvidence` and `documentationEvidence` for each standard. Note that:

- `codeEvidence` indicates a possible implementation and must be verified through code review and runtime checks
- `documentationEvidence` is for design context only and cannot establish compliance
- The scanner skips `.env`, `agent.config.json`, `.git`, build artifacts, and common data directories

Use `templates/review-report.md` for the final report. At minimum, include applicable profiles, standard IDs, status, risk level, evidence type, and actionable remediation for Critical/High gaps.

### Smoke test

```bash
node smoke-test.mjs
```

The smoke test checks that the scanner can find baseline evaluation and observability evidence. Before running it, make sure the configured target directory exists: `stage7-eval-observability`.

### Safety boundaries

This Skill is for review only. Do not perform writes, deployments, payments, messaging, deletion, or external publication as part of a review. Do not expose secrets or private user data. Address Critical/High risks before style and cosmetic issues.
