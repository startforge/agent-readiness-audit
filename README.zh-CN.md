# Agent Framework Review

<p align="right"><a href="README.md">English</a></p>

这是一个用于审查 Agent 工程成熟度与风险的 Codex Skill。它按照统一的运行时、工具、权限、安全、评测、可观测性和专项能力标准，帮助输出有证据的架构审查报告。

## 功能

- 根据工程能力选择适用 Profile：`core`、`rag`、`workflow`、`skill`、`browser`
- 使用标准 ID（例如 `R-01`、`T-02`、`O-03`）整理审查结论
- 通过只读静态扫描收集候选代码证据
- 使用报告模板汇总状态、风险等级、证据、指标和整改优先级
- 明确区分静态扫描、代码阅读、测试和运行 Trace，避免把匹配结果误判为运行时通过

## 目录

```text
.
├── SKILL.md                               # Skill 定义与执行规则
├── references/agent-framework-standard.md # 审查标准与标准 ID
├── scripts/inspect-project.mjs             # 只读静态扫描脚本
├── templates/review-report.md              # 审查报告模板
├── smoke-test.mjs                           # 基础验收测试
└── README.md                                # English documentation
```

## 使用

在目标 Agent 工程目录运行静态扫描：

```bash
node scripts/inspect-project.mjs <target-directory>
```

脚本会输出 JSON，包含扫描文件数量、各标准项的 `codeEvidence` 和 `documentationEvidence`。`codeEvidence` 仅表示可能存在实现，需要结合代码阅读和运行验证；`documentationEvidence` 只能帮助理解设计，不能作为通过依据。脚本不会读取 `.env`、`agent.config.json`、`.git`、构建产物或常见数据目录。

使用 `templates/review-report.md` 编写最终报告。报告应包含适用 Profile、标准 ID、状态、风险等级、证据类型，以及 Critical/High 缺口的可执行整改建议。

## Smoke test

```bash
node smoke-test.mjs
```

Smoke test 会验证扫描器能够发现基础的评测和可观测性候选证据。运行前请确认测试脚本中配置的目标目录存在：`stage7-eval-observability`。

## 安全边界

该 Skill 仅用于审查，不应为了完成审查而执行写操作、部署、付款、发信、删除或外部发布。审查过程中不要泄露密钥或用户私密信息；Critical/High 风险项应优先于代码风格问题处理。
