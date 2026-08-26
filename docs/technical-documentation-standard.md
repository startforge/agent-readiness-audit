# Agent Framework Review 技术文档与证据规范

## 目的

本规范约束审查工具自身的设计文档、规则文档、测试夹具和输出报告。目标是让任何结论可追溯、可复核、可重复验证，且文档不会被误当作实现证明。

## 文档层级

| 文档 | 用途 | 必填内容 |
| --- | --- | --- |
| `README.md` | 安装、调用与项目概览 | 用途、安装提示词、命令、输出示例、限制 |
| `docs/development-plan.md` | 路线图与阶段验收 | 目标、范围、阶段、验收标准、依赖 |
| `references/agent-framework-standard.md` | 审查标准的规范来源 | ID、风险、适用 Profile、通过/失败证据 |
| `docs/rules/<id>.md` | 单项规则说明 | 目的、检测逻辑、误报边界、夹具、整改建议 |
| `docs/adr/NNNN-title.md` | 关键设计决策 | 背景、决策、替代方案、后果 |
| `templates/review-report.md` | 报告结构 | 范围、发现项、证据、风险、建议、基线 |

## 标准项规范

每个审查标准必须具备唯一 ID，例如 `T-02`。新增或修改标准时，必须更新标准文档、规则文档、测试夹具和报告说明。

每个标准项至少包含：

```markdown
## T-02 Tool 权限与作用域检查

- Profile：core
- 风险：Critical
- 要求：所有 Tool 调用都必须经过权限和作用域检查。
- 适用条件：项目存在可调用的 Tool 或外部副作用。
- 静态证据：权限门、allowlist、目录或域名约束。
- 结构证据：Tool 执行器由权限门支配，且无绕过路径。
- 测试证据：未授权和越权调用被拒绝。
- 运行证据：Trace 记录判定结果与拒绝原因。
- 通过条件：满足结构证据，且至少有测试或运行证据。
- 常见误报：注释、未调用的 `authorize()`、仅前端限制。
- 整改与验收：...
```

## 证据模型

统一使用以下 Evidence 结构：

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

证据等级从强到弱：`runtime`、`test`、`code`、`configuration`、`documentation`。文档证据只能用于导航、范围解释或一致性检查，不能独立产生 `pass`。

## 状态与置信度

允许状态：

| 状态 | 规则 |
| --- | --- |
| `pass` | 满足通过条件，且证据足以支撑结论 |
| `partial` | 有实现但关键路径、范围或验证不完整 |
| `fail` | 发现明确缺失或可复现违规路径 |
| `manual-review` | 自动化无法可靠判定，需要审查者验证 |
| `not-applicable` | 不适用，必须说明项目范围理由 |
| `unknown` | 没有足够证据，不得暗示通过 |

置信度：

- `high`：至少有运行证据，或有结构分析加测试证据。
- `medium`：代码实现和配置/测试部分支持，但未验证完整路径。
- `low`：仅关键词、文档声明或孤立片段。

## 文档读取规范

审查开始时，优先读取高价值文档以建立预期实现地图：`README`、`docs/`、ADR、`AGENTS.md`、`CLAUDE.md`、`SKILL.md`、Schema、测试与部署说明。

每条文档声明必须记录：来源、原始内容摘要、预期代码区域和验证状态。例如：

```json
{
  "claim": "All tool calls pass through PermissionGate.",
  "source": "docs/architecture.md:42",
  "expectedCodeAreas": ["src/tools", "src/security"],
  "verification": "pending"
}
```

文档与代码不一致时，必须作为单独发现项报告：

- 文档声明存在、代码未验证：`manual-review` 或 `partial`。
- 代码实现存在、文档缺失：标记可维护性问题。
- 两者一致：仍需测试或运行证据确定 `pass`。

## 规则与测试规范

每条自动规则必须有：

- 一个 `pass` 夹具。
- 一个 `fail` 夹具。
- 一个 `partial` 或绕过夹具。
- 预期状态、风险和关键证据断言。
- 误报说明；如匹配注释、死代码、测试代码时的处理。

规则变更不可只更新正例；必须运行全量夹具，以防降低已有规则准确度。

## 报告规范

每份报告必须包含：

- 目标项目、扫描时间、commit SHA 和审查工具版本。
- 启用 Profile 与不适用项理由。
- 审查方式：静态、文档、测试、运行 Trace。
- 每项发现的标准 ID、状态、风险、置信度、证据和建议。
- Critical / High 缺口的影响、验收条件和优先级。
- 成功率、延迟、成本、Tool 调用次数等可用基线。
- 未运行测试、缺少 Trace 或无法访问文件等限制。

禁止：

- 将文档匹配写成代码实现已通过。
- 没有证据就输出确定性的 `pass` 或 `fail`。
- 输出密钥、完整敏感数据或用户私密内容。
- 混淆扫描器结论和人工复核结论。

## 变更管理

- 标准或规则的破坏性变化必须增加版本号并记录 ADR。
- 新增 Critical / High 标准前，必须先提供夹具和整改模板。
- 每次发布记录规则数量、标准项覆盖率、误报/漏报样本、执行时长和已知限制。
