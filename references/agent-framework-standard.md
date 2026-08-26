# Agent Framework 工程标准

本标准用于评审已有 Agent 工程。它定义**最低要求**、**推荐要求**、证据形式和风险等级；不把某种框架、模型或部署平台设为唯一答案。

## 1. 使用规则

- `MUST`：适用时必须满足；不满足则不能认为工程已具备该能力。
- `SHOULD`：强烈建议；不一定阻止发布，但必须写明风险或计划。
- `N/A`：功能不在本项目范围内，可不适用；必须提供范围说明，不能用 N/A 隐藏缺失。
- 每一项需要代码、测试、Trace、配置或运行结果作为证据。
- 静态扫描只能发现“可能存在”；最终结论必须结合代码阅读和运行证据。

## 2. 风险等级

| 等级 | 含义 | 处理建议 |
| --- | --- | --- |
| Critical | 可导致越权、泄密、不可逆外部操作或无限成本 | 发布前必须修复 |
| High | 任务可能失控、无法恢复或无法验证完成 | 核心功能前修复 |
| Medium | 质量、稳定性或定位效率不足 | 进入整改计划 |
| Low | 可维护性、文档或体验改进 | 按优先级处理 |

## 3. Core Profile：所有 Agent 都适用

| ID | 等级 | 标准 | 通过证据 |
| --- | --- | --- | --- |
| R-01 | High | 有明确 Agent Loop，模型决策与外部执行分离。 | `Runtime`/循环代码和结构化决策类型。 |
| R-02 | High | 模型输出或工具意图有 Schema 校验。 | JSON Schema、Zod、TypeScript guard 或解析失败处理。 |
| R-03 | High | 每次运行存在最大步数、最大时长或调用预算。 | `maxSteps`、timeout、budget、loop guard 及测试。 |
| R-04 | Medium | 有可持久化任务状态或明确声明无状态。 | Session/TaskState、状态迁移或无状态设计说明。 |
| R-05 | Medium | 上下文有长度/Token 预算与截断策略。 | ContextBuilder、compaction、limitContext。 |
| T-01 | High | Tool 输入、输出、错误边界明确。 | Tool Schema、结果类型、错误转换。 |
| T-02 | Critical | Tool 调用经过权限和作用域检查。 | PermissionGate、白名单、工作目录/域名约束。 |
| T-03 | Critical | 删除、付款、发布、发信等危险操作需要确认。 | Approval gate、确认记录和拒绝路径。 |
| O-01 | Medium | 每次运行有 Trace，可关联 run/session/task。 | JSONL/OTel/日志事件和 ID。 |
| O-02 | Medium | 记录调用次数、延迟、Token/成本或标记成本不可用。 | Metrics 收集代码和报告。 |
| O-03 | High | 日志、Trace、错误输出不泄露 Key、密码或完整敏感数据。 | Redaction/filter 和测试。 |
| E-01 | High | 有固定评测或回归测试，不只依赖人工 Demo。 | 可重复执行的测试集、期望结果和命令。 |
| E-02 | Medium | 失败可归因到 Prompt、Tool、Retrieval、Model、State、Safety 等。 | failure category 和 Trace 对照。 |
| S-01 | High | 检测 Prompt Injection、Data Exfiltration、Tool Abuse，或明确限定输入来源。 | 风险策略、工具参数限制、测试用例。 |

## 4. RAG Profile：使用私有知识库时适用

| ID | 等级 | 标准 | 通过证据 |
| --- | --- | --- | --- |
| K-01 | Medium | Chunk 有稳定 ID、来源和位置。 | Chunk Schema 和索引样例。 |
| K-02 | High | 查询与文档使用兼容 Embedding，并有失败处理。 | Embedding Adapter、模型配置和错误处理。 |
| K-03 | Medium | 检索记录 Top-K、相似度或召回证据。 | Retriever 输出、Trace。 |
| K-04 | High | 上下文构建会去重、截断，并禁止无依据编造。 | ContextBuilder、提示词与测试。 |
| K-05 | Medium | 索引支持版本识别、重建或缓存失效。 | Index metadata、cache version 或 rebuild 命令。 |

## 5. Workflow Profile：多 Agent 或复杂流程时适用

| ID | 等级 | 标准 | 通过证据 |
| --- | --- | --- | --- |
| W-01 | High | 每个角色有单一职责和输入输出 Schema。 | Planner/Writer/Reviewer 等类型和接口。 |
| W-02 | High | 任务目标在流程中显式传播，并检查任务漂移。 | `goal`、topic validation、Reviewer 目标输入。 |
| W-03 | High | 有可观察的停止条件、最大返工次数和循环检测。 | Graph router、revision limit、LoopGuard。 |
| W-04 | Medium | Reviewer/Critic 不直接修改结果，返工通过明确反馈回到执行者。 | 审核结果类型和 revision 路径。 |

## 6. Skill Profile：使用 Skills 时适用

| ID | 等级 | 标准 | 通过证据 |
| --- | --- | --- | --- |
| SK-01 | Medium | Skill 有名称、用途、触发条件、步骤和验收标准。 | `SKILL.md`。 |
| SK-02 | High | Skill 的脚本、模板和引用资源按需加载。 | Registry/loader、资源路径。 |
| SK-03 | Critical | Skill 不绕过 Tool 权限、工作目录或密钥保护。 | Skill 执行通过 Runtime/PermissionGate。 |
| SK-04 | Medium | Skill 有 smoke test 或任务成功率证据。 | 测试命令、测试结果。 |

## 7. Browser/Computer-Use Profile：操作 UI 时适用

| ID | 等级 | 标准 | 通过证据 |
| --- | --- | --- | --- |
| B-01 | High | 动作前观察页面，动作后重新观察并验证。 | DOM/截图前后证据、状态机。 |
| B-02 | Critical | 域名、登录、支付、下载、表单提交等有安全限制。 | Browser policy、人工确认。 |
| B-03 | Medium | 能处理加载失败、元素定位失败、页面变化和弹窗。 | timeout/retry/error state/测试。 |
| B-04 | Medium | 保存 DOM、截图、动作日志和最终验证证据。 | artifact 路径和 Trace。 |

## 8. 评分与发布门槛

审查报告应将每项标记为 `pass`、`fail`、`partial`、`not-applicable` 或 `manual-review`。

- 任一适用的 Critical `fail`：不建议发布。
- 任一适用的 High `fail`：不得宣称为“生产可用”。
- Core Profile 的 High 全部通过，且存在固定评测：可以进入受控试运行。
- 成功率、成本、延迟没有统一阈值；必须按业务制定目标，并在报告里写出基线。

## 9. 最低整改顺序

```text
1. Critical：权限、确认、密钥和敏感数据
2. High：结构化输出、停止条件、工具边界、评测
3. Medium：Session、上下文、Trace、失败分类
4. Low：文档、命名、报告可读性
```

## 10. 审查报告模板

```markdown
# Agent Framework Review

## 范围

- 工程：...
- Profile：core / rag / workflow / skill / browser
- 审查方式：静态扫描 + 代码阅读 + 测试运行

## 发布结论

- 状态：blocked / conditional / ready-for-pilot
- Critical：0
- High：2

## 发现项

| ID | 状态 | 等级 | 证据 | 建议 |
| --- | --- | --- | --- | --- |

## 指标基线

- 成功率：...
- p50/p95 延迟：...
- 单任务成本：...
- 工具调用次数：...

## 后续整改

1. ...
```
