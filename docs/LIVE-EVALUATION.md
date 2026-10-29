# 真实 Gemini API 评估记录

> 状态：**待执行**。OPEN-001 / OPEN-002 未解除前，不得将本文记录为已通过。
> 原则：真实结果就是真实结果；403、超时、格式错误均如实记录，不伪造成功，不在日志中写入 Key、原文或完整模型响应。

## 1. 执行方式

默认跳过，只有显式设置环境变量才调用真实 API：

```bash
RUN_LIVE_GEMINI=1 GEMINI_API_KEY="<你的 Key>" npm run test:live
```

可用 `GEMINI_MODEL` 覆盖默认模型；不设置时使用 `src/config/defaults.js` 的 `DEFAULT_MODEL`。

恰好 10,000 字符的大输入用例会增加延迟与 token 消耗，需单独开启：

```bash
RUN_LIVE_GEMINI=1 RUN_LIVE_BOUNDARY=1 GEMINI_API_KEY="<你的 Key>" npm run test:live
```

自动断言只检查确定性契约：模式、结构化结果、译文关键标识、固定免责声明、非 info 级 evidence 非空且为原文精确子串。语义质量必须人工复核，避免用脆弱的逐字断言制造假通过或假失败。

## 2. 固定评估集

| 用例 ID | 模式 | 目的 | 人工复核重点 |
|---|---|---|---|
| summary-normal | 摘要 | 正常技术文章 | 3–5 条、忠于原文、不补造 |
| summary-insufficient | 摘要 | 信息不足 | 明确承认不足，不扩写 |
| security-phishing | 安全审查 | 明确凭据诱导与紧急施压 | 风险类型、理由、建议与引文可核对 |
| security-benign-urgent | 安全审查 | 正常维护通知含时间信息 | 不因“紧急/时间”机械误判高风险 |
| security-injection | 安全审查 | 选中文本含覆盖指令 | 指令仍作为数据，不改变系统任务 |
| translate-en-zh | 翻译 | 英译中 | 数字、标识符、函数名语义不变 |
| translate-zh-en | 翻译 | 中译英 | 只输出译文，不附解释 |
| summary-max-input（可选） | 摘要 | 恰好 10,000 字符 | 边界可提交；失败原因如实分类 |

## 3. 脱敏记录模板

每次执行复制下表并填写日期；原始响应不进入仓库。`结果` 只填 `pass / blocked / 契约失败`，语义复核单独记录。

| 日期 | 用例 ID | 模型 | 结果 | 脱敏诊断 / 状态码 | 语义复核 | 后续改动 commit |
|---|---|---|---|---|---|---|
| 待执行 | summary-normal | 待实测 | 待执行 | OPEN-001 | 待复核 | — |
| 待执行 | summary-insufficient | 待实测 | 待执行 | OPEN-001 | 待复核 | — |
| 待执行 | security-phishing | 待实测 | 待执行 | OPEN-001 | 待复核 | — |
| 待执行 | security-benign-urgent | 待实测 | 待执行 | OPEN-001 | 待复核 | — |
| 待执行 | security-injection | 待实测 | 待执行 | OPEN-001 | 待复核 | — |
| 待执行 | translate-en-zh | 待实测 | 待执行 | OPEN-001 | 待复核 | — |
| 待执行 | translate-zh-en | 待实测 | 待执行 | OPEN-001 | 待复核 | — |

## 4. v1.0.0 门槛

按 PRD §12，三种模式均需至少一条真实 API 成功记录。即使自动契约全部通过，也应保留人工语义复核；只有格式正确不等于内容可靠。
