# Agent Framework Review 开发计划

## 目标

将当前基于关键词的静态扫描器升级为以代码为主、文档为导航、测试和运行证据可验证的 Agent 工程审查工具。最终输出应能说明每项结论的标准 ID、状态、风险、证据、置信度和整改方式。

## 设计原则

- 代码、测试和运行 Trace 是实现证据；项目文档只用于建立预期实现地图。
- 未找到证据不等于失败；自动化不能可靠判断时输出 `unknown` 或 `manual-review`。
- 每个 Critical / High 结论都必须关联文件、行号、证据类型和验收条件。
- 对使用者只暴露一个审查入口；文件发现、规则执行、证据归并和报告生成由内部模块处理。
- 不读取 `.env`、密钥或私密目录；不执行危险外部操作。

## 目标接口

```bash
node scripts/review-project.mjs <target-directory> \
  --profiles core,rag,workflow \
  --format markdown \
  --output review-report.md
```

默认行为：自动发现语言、文档、测试和适用 Profile；只读扫描；输出 JSON 或 Markdown。`core` Profile 永远启用，其余 Profile 可自动建议或由调用者显式指定。

## 内部模块与职责

| 模块 | 职责 | 输入 | 输出 |
| --- | --- | --- | --- |
| Project Discovery | 识别语言、框架、入口、测试、配置及忽略目录 | 项目目录 | 项目清单与能力画像 |
| Documentation Index | 阅读高价值项目文档，提取架构声明和预期代码区域 | 文档清单 | 文档索引与预期实现地图 |
| Evidence Collector | 提取代码、配置、测试和 Trace 证据 | 文件清单、规则 | 带位置和片段的证据 |
| Rule Engine | 按标准项执行静态、结构、测试和运行规则 | 证据、Profile | 候选状态与缺失证据 |
| Confidence Engine | 根据证据等级计算置信度，禁止以文档直接判定通过 | 规则结果 | `high` / `medium` / `low` |
| Report Builder | 生成 JSON、Markdown 和机器可读结果 | 已归并的发现项 | 审查报告 |

内部模块应有清晰的 seam；例如 Rule Engine 只依赖标准化 Evidence，不直接遍历文件。这样语言解析器和 Trace 读取器可以替换，而规则判定保持稳定。

## 分阶段交付

### Phase 0：基线与夹具

目标：建立可重复的反馈回路，避免规则升级后无法判断质量。

- 创建 `fixtures/`：每个标准至少包含 `pass`、`fail`、`partial` 样例。
- 创建规则测试：一个命令可运行全部夹具并断言预期状态。
- 明确基线：当前规则数、标准项覆盖率、误报样本、漏报样本。
- 为现有 `inspect-project.mjs` 保留兼容 smoke test。

验收：规则测试可在本地无网络运行，且能对至少一个错误实现稳定报红。

### Phase 1：扫描结果可追溯

目标：从“匹配了哪个文件”升级为“为什么匹配、匹配在哪里”。

- 支持 `.ts`、`.tsx`、`.js`、`.mjs`、`.py`、`.json`、`.yaml`、`.yml`、`.toml`、`.sh`、`.md`。
- 每条证据输出：文件、行号、片段、证据类型、匹配原因。
- 区分生产代码、测试、文档、配置和生成文件。
- 建立标准 ID 与规则的完整映射；未实现的标准明确标记为 `manual-review`。
- 将旧的 `codeEvidence` / `documentationEvidence` 输出迁移到统一 Evidence 格式。

验收：所有当前标准 ID 均有规则、人工检查项或明确的 `manual-review` 说明。

### Phase 2：文档优先的定向代码阅读

目标：减少无目的代码读取，提升 Codex 审查效率。

- 默认读取 `README`、`docs/`、ADR、`AGENTS.md`、`CLAUDE.md`、`SKILL.md`、OpenAPI/Schema 文件。
- 提取架构声明：Agent Loop、Tool 清单、权限模型、数据来源、Trace、部署和测试命令。
- 为每条声明记录来源和预期代码区域。
- 将“文档声明”与“代码实现”交叉比对：文档有代码无、代码有文档无、两者一致。
- 可选支持 `.docx` / `.pdf` 文本提取；其证据等级始终为 `documentation`，不能单独判定 `pass`。

验收：对有架构文档的夹具，扫描器可减少无关文件读取，并产出文档—代码一致性发现项。

### Phase 3：结构与调用链验证

目标：降低关键词误报，验证关键安全路径未被绕过。

- 对 TS/JS 使用 AST；Python 使用 Python AST 或等价解析器。
- 识别 Tool 注册、模型输出解析、权限门、确认门、执行器、Trace 记录器。
- 检查关键链路：`模型输出 → schema 校验 → 权限检查 → 确认 → Tool 执行 → Trace`。
- 针对 T-02、T-03、R-02、R-03、O-03 优先实现数据流与调用链规则。
- 检测绕过路径：直接执行危险 Tool、未授权写文件、无确认的外部副作用。

验收：正例、反例和绕过样例均得到正确结论；规则不因注释或文档命中而误判通过。

### Phase 4：测试、评测与运行证据

目标：让高风险结论具备可重复验证依据。

- 自动发现 `package.json`、`pyproject.toml`、`Makefile`、CI 配置中的测试命令，但只在授权范围内执行。
- 支持导入 JSONL、OpenTelemetry 导出或应用 Trace 作为运行证据。
- 记录成功率、p50/p95 延迟、Token/成本、Tool 调用次数和失败分类。
- 增加安全夹具：Prompt Injection、越权 Tool、危险操作拒绝、日志泄密。
- 无运行验证时，Critical / High 项不能仅依赖关键词判定 `pass`。

验收：至少一组集成夹具证明权限拒绝、确认门和 Trace 关联均有效。

### Phase 5：报告、CI 与质量治理

目标：让审查结果可消费、可比较、可持续改进。

- 输出 JSON、Markdown；可选 SARIF。
- 支持与上一份报告比较风险变化。
- 输出规则版本、扫描时间、项目 commit SHA、Profile 和证据摘要。
- 在 CI 中提供只读审查命令和失败阈值配置。
- 统计规则覆盖率、误报率、漏报率、`manual-review` 比例和执行时间。

验收：CI 可阻断新增 Critical `fail`；报告可定位到具体证据和验收动作。

## 优先级

1. Phase 0、Phase 1：建立可靠测试与可追溯扫描结果。
2. Phase 2：文档索引，降低审查成本。
3. Phase 3：关键安全链路的结构分析，优先提高准确度。
4. Phase 4：运行证据，使结论可验证。
5. Phase 5：CI 与趋势治理。

## 完成定义

- 所有标准项都有检查策略和证据要求。
- 文档不再被当作实现通过证据。
- 每项 Critical / High 发现都可定位到证据并给出验收条件。
- 测试夹具可检测典型误报、漏报和权限绕过。
- 审查报告能区分静态、测试和运行期结论。
