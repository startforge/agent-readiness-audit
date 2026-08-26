---
name: agent-framework-review
description: 对 Agent 工程按统一运行时、权限、安全、评测和可观测性标准进行审查，并输出有证据的整改报告。
version: 1.0.0
triggers: [agent review, agent 架构审查, agent 标准检查, agent 安全评审]
---

# Agent Framework Review

用于审查已有 Agent 工程的架构完成度和风险。不要把静态扫描结果当作运行时证明；每项结论都应标注证据类型。

## 执行步骤

1. 确认工程范围和适用 Profile：`core` 必选，`rag`、`workflow`、`skill`、`browser` 按功能启用。
2. 阅读 [references/agent-framework-standard.md](references/agent-framework-standard.md)，以标准 ID 和风险等级输出结论。
3. 运行 `scripts/inspect-project.mjs <target-directory>` 收集静态证据；只把 `codeEvidence` 作为候选实现，`documentationEvidence` 仅用于理解设计。
4. 阅读 Runtime、Tool、权限、Session、Trace、测试和配置入口，验证扫描发现。
5. 在授权范围内运行已有测试和评测；未运行时标记 `manual-review`，不要假装通过。
6. 使用 `templates/review-report.md` 输出发布结论、证据、缺口和按风险排序的整改建议。

## 约束

- 不读取 `.env`、`agent.config.json`、密钥或用户私密目录。
- 不执行写操作、部署、付款、发信、删除或外部发布来完成审查。
- 不适用项必须说明理由。
- Critical/High 缺口先于代码风格问题报告。

## 脚本

- `scripts/inspect-project.mjs`：只读扫描 TypeScript/JavaScript/Markdown 文件，输出标准项的候选证据；开始审查时运行。

## 模板

- `templates/review-report.md`：最终架构审查报告；汇总证据后使用。

## 验收标准

- 报告包含适用 Profile、标准 ID、状态、风险等级和证据。
- Critical/High 缺口有可执行整改建议。
- 静态扫描、代码阅读和运行验证被明确区分。
- 不泄露扫描到的敏感信息。
