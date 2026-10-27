# 未决技术决策

基线日期：2026-10-26。以下事项不能通过更换代码、真实 Key 或推断来提前关闭。

## OPEN-001: 当前 Google Cloud 项目无免费层推理资格

- 状态：Blocked，等待项目资格或用户选择合规可用项目。
- 已知输入：交接材料记录 `403 PERMISSION_DENIED - The Gemini API free tier is not available for this project`；本轮未接触真实 Key，未独立重放。
- 官方结论：免费层资格按项目评估；同项目新建 Key 不能解决。`models.list` 的 200 只验证元数据访问，不证明 `interactions` 推理可用。
- 不可采用：绑定信用卡、跨区网络、代理绕过、伪造成功结果、把 `models.list` 200 当推理通过。
- 下一步：用户在 AI Studio 检查项目状态，选择官方允许且无付费前置的可用项目，或在 DevFest 向官方人员确认资格路径；Key 仅由用户本地保存。
- 关闭证据：同一项目、同一 Key 的最小非敏感 Interactions 请求返回 completed；记录脱敏 HTTP 状态、模型、时间和官方依据，不记录 Key、完整请求或完整响应。
- 阻塞范围：真实 Gemini 验收。离线实现、Mock E2E 和本地演示不阻塞。
- 来源：https://ai.google.dev/gemini-api/docs/troubleshooting?hl=zh-cn

## OPEN-002: 当前项目的默认模型尚未实测

- 状态：Blocked by OPEN-001。
- 候选：`gemini-3.8-flash`。依据 2026-10-26 官方文档示例（ai.google.dev/gemini-api/docs 首页与 Interactions Overview 均使用此模型名）。
- **2026-10-26 外部评审核查**：有评审者认为应使用 `gemini-2.5-flash` + `generateContent` 端点，经官方文档核实该判断基于 2026 年 6 月前的旧知识。官方明确 Interactions API 自 2026 年 6 月起为默认接口，`generateContent` 已标记 legacy。模型名已从 `gemini-3.5-flash` 修正为官方当前示例的 `gemini-3.8-flash`。
- 不采用交接推断：不预设 `gemini-2.0-flash` 或 `gemini-2.5-flash` 对所有新用户不可用，也不预设某模型必然需要付费。
- 下一步：OPEN-001 解除后，对候选模型执行最小 Interactions 推理；再各跑一次摘要、安全审查和中英互译。记录实际模型、revision、状态与脱敏错误。
- 决策规则：通过后才写入默认配置；404 或无权限时只展示错误，不自动换模型；任何付费候选需用户另行明确决定，不属于当前约束。
- 关闭证据：上述真实测试记录和对应 fixtures 已更新，README 支持矩阵与实际一致。
- 来源：https://ai.google.dev/gemini-api/docs/models 与 https://ai.google.dev/gemini-api/docs/pricing
