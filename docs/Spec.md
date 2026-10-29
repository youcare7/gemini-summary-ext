# Spec - Gemini 极简速审助手 v1.0.0

> 生成日期：2026-10-26
> 基于：PRD v1.0 + ARCHITECTURE v1.0 + UIUX v1.0（三文档已经用户确认）
> 状态：已确认（三项冲突决策由用户锁定，见 CONSISTENCY-REVIEW）
> 本 Spec 是规格即契约——开发、测试、验收的唯一依据。任何超出本 Spec 的改动走变更流程。

---

## 1. 产品定义

- **一句话描述**：Chrome 划词速审扩展——对用户主动选中的一小段文本执行摘要、安全审查辅助或中英翻译，结果可核对、失败不伪装。
- **目标用户**：软件工程/网安方向学生与初级开发者；需轻量、可自管 API Key 的网页阅读辅助工具。
- **核心问题**：通用 AI 扩展过重、订阅复杂；翻译工具不覆盖风险解释；安全工具不做文本级社工分析；用户需要一个边界清晰、失败可信的三模式小工具。

## 2. MVP 范围（锁定——不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 | RICE |
|--------|------|-------------|-------|
| P0 | BYOK 配置（仅 session）与错误处理 | 未配置不发请求；错误分类+下一步；清除即回到未配置 | 6.00 |
| P0 | 摘要、安全审查、中英翻译三模式 | 三模式各有固定样例通过；安全结论含依据与不确定性 | 4.00 |
| P0 | README、演示 GIF、固定样例测试、Release | 新用户按文档可复现；真实/演示分标 | 5.33 |
| P0 | 结果复制与重新提交 | 复制有反馈；新请求使旧结果标失效 | 5.60 |

## 3. 明确不做（Out-of-Scope——锁定）

| 不做的功能 | 原因 | 何时考虑 |
|------------|------|----------|
| Key 本地持久化"记住我" | MVP 优先降低凭据落盘风险 | v1.1，有真实用户反馈后 |
| 多模型/多供应商/自动路由 | 增加配置与测试复杂度 | 有明确需求后 |
| 整页抓取、后台读网页、历史同步 | 违反最小数据边界 | 不计划 |
| PDF/图片/OCR/视频/语音 | 超出文本划词定位 | 不计划 |
| 对话追问、自定义提示词 | MVP 聚焦三模式 | v2.0 |
| 用户账户/云同步/团队协作/订阅 | 无后端、无支付 | 不计划 |
| 自动访问 URL、实时 IOC 查询、恶意文件扫描 | 安全边界不同；应交专业工具 | 显式外链工作流 |
| "绝对安全"结论/准确率宣传 | 生成式输出不可作保证 | 不计划 |
| 跨区代理、绑卡开 Billing | 用户硬约束 | 不计划 |
| Edge/Firefox/移动端/国际化框架 | 仅 Chrome 中文界面 | 有真实需求后 |
| 生产持久日志/远程埋点 | 用户决策：日志不记录 | 有隐私评估后 |
| emoji 功能图标、紫粉渐变、空洞占位文案 | P0 红线 | 永不 |

## 4. 技术架构（锁定）

| 层 | 技术 | 实际版本 | 锁定原因 |
|----|------|---------|---------|
| 运行时 | 原生 JavaScript ES modules | Chrome ≥ 127 | 零依赖、直接加载、学习成本低 |
| 平台 | Manifest V3 | - | Chrome 扩展当前标准 |
| 请求层 | Service Worker 内 fetch 直连 REST | - | 弹窗生命周期不稳；不自建代理 |
| API | Gemini Interactions API | `Api-Revision: 2026-05-20` | 官方新项目推荐主线 |
| 存储 | `chrome.storage.session`（Key/正文/状态） | - | 敏感数据不落盘；sync/local 禁止存 Key 与正文 |
| 单元测试 | `node:test` | Node 22.22.2 | 零依赖 |
| E2E | `@playwright/test` | 1.64.1（devDependency） | 官方支持 MV3 扩展 persistent context |
| 图标 | `lucide-static` 本地 SVG | 1.61.0（devDependency） | 统一描边、无运行时、无 CDN |
| UI 框架 | 无（原生 HTML/CSS/JS） | - | 简单弹窗不需要框架 |
| 构建/打包 | 无打包器；发布 ZIP 手工核对 | - | 减少维护面 |

## 5. API 端点清单（锁定）

外部 Gemini API，子集见 `docs/openapi.yaml`：

| Method | Path | 功能 | 认证 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| POST | `https://generativelanguage.googleapis.com/v1beta/interactions` | 无状态文本分析 | `x-goog-api-key` header | `model`, `system_instruction`, `input`, `store:false`, `stream:false`, `generation_config`, `response_format` | `status`, `steps[]`（取 `model_output` 的 `text`） |

内部消息（chrome.runtime）：

| 类型 | 方向 | 载荷 |
|------|------|------|
| `ANALYZE_REQUEST` | popup → background | `requestId`, `mode`, `text`, `targetLanguage` |
| `ANALYZE_RESPONSE` | background → popup | `requestId`, `ok`, `result`/`error`, `meta` |
| `SAVE_KEY` / `CLEAR_KEY` / `GET_STATE` | popup ↔ background | Key 管理，值不回显 |

## 6. 数据库表清单

无。本项目无后端、无数据库。所有状态存于 `chrome.storage.session`（会话级）与 `chrome.storage.local`（仅非敏感偏好：模式、目标语言）。

## 7. 页面清单（锁定）

| 页面 | 路由 | 核心组件 | 对应 API | 设计 Token 主题 |
|------|------|----------|---------|----------------|
| 主视图 | popup.html#main | 模式单选组、翻译方向、原文预览/展开、主按钮、状态区、结果区、复制 | ANALYZE_REQUEST | light |
| 设置视图 | popup.html#settings | Key 输入（password）、显示/隐藏、保存到会话、清除密钥（内联确认）、离线演示入口、官方 Key 获取链接 | SAVE_KEY / CLEAR_KEY | light |

## 8. 设计 Token（锁定）

- **主色**：`oklch(45% 0.09 185)`（Google 蓝单色系，无渐变）
- **危险/成功/警告**：见 UIUX Token 表
- **字体**：`"Segoe UI Variable", "Noto Sans SC", "Microsoft YaHei", sans-serif`；等宽 `"Cascadia Code", Consolas, monospace`
- **图标库**：Lucide 本地静态 SVG（16/20/24px，2px stroke，currentColor）
- **主题**：浅色单主题
- **弹窗**：宽 320px（border-box），最大内容高 560px，内边距 16px，4px 网格
- **动效**：仅颜色/边框/透明度 150ms，布局 ≤200ms；`prefers-reduced-motion` 降级
- **禁止**：emoji 图标、紫粉渐变、毛玻璃、裸色值写入组件、innerHTML 注入

## 9. 验收标准（锁定——QA 唯一依据）

| 编号 | 功能 | EARS 验收标准 | 优先级 |
|------|------|--------------|--------|
| AC-01 | BYOK | When 用户未配置 Key 时点击分析，系统**必须**在发送请求前显示配置指引，不发任何网络请求 | P0 |
| AC-02 | BYOK | When 用户保存 Key，系统**必须**仅写入 `chrome.storage.session`，不回显完整 Key，不写日志 | P0 |
| AC-03 | BYOK | When 用户清除 Key，系统**必须**立即回到未配置状态，后续请求不发送 | P0 |
| AC-04 | 摘要 | When 已配置且输入为有明确论点的文本并选择摘要，系统**必须**返回 3–5 条与原文一致的要点 | P0 |
| AC-05 | 摘要 | If 选中文本信息不足，系统**必须**明确提示不足以形成可靠摘要，不补造内容 | P0 |
| AC-06 | 安全审查 | When 文本含凭据诱导等风险信号，系统**必须**输出风险类型、原文依据、理由、不确定性、建议 | P0 |
| AC-07 | 安全审查 | If 文本无明显风险信号，系统**必须**提示不代表链接/文件/发送者安全，不得输出"绝对安全" | P0 |
| AC-08 | 翻译 | When 输入英文并自动识别，系统**必须**输出中文译文；数字与代码语义不变 | P0 |
| AC-09 | 翻译 | When 手动选择中译英，系统**必须**只输出英文译文，不附摘要/安全建议 | P0 |
| AC-10 | 错误 | If API 返回 401/403/429/超时/格式异常，系统**必须**显示分类原因与下一步，不显示模拟成功 | P0 |
| AC-11 | 演示 | When 用户进入离线演示，系统**必须**全程标注"离线演示，非 Gemini API 结果" | P0 |
| AC-12 | 边界 | If 输入为空或超过 10,000 字符，系统**必须**本地拒绝并显示原因，不静默截断 | P0 |
| AC-13 | 日志 | While 生产模式运行，系统**必须**不持久记录原文、Key、完整响应或请求头 | P0 |
| AC-14 | 来源 | While 显示结果，系统**必须**持续展示结果来源（真实 API / 离线演示）、模式、时间 | P0 |
| AC-15 | 旧结果 | When 输入或模式改变，系统**必须**将旧结果标记为已失效，不冒充当前结果 | P1 |
| AC-16 | 安全渲染 | When 模型输出含 HTML/脚本，系统**必须**按纯文本渲染，不执行注入内容 | P0 |
| AC-17 | 安全硬约束 | If 非 info 级 finding 的 evidence 为空或不是原文精确子串，或 security 输出缺少固定免责声明，系统**必须**判整个结果无效且不展示成功 | P0 |

## 10. 边界与约束

- 输入上限 10,000 字符（JS `.length`，trim 后判断）；等于可提交，超过本地拒绝。
- 超时 30 秒；429/5xx 可重试最多 2 次（指数退避+抖动，总预算 90 秒）；4xx 不自动重试。
- 同一时刻仅一个活动请求；`requestId` 绑定来源文本/模式/方向，旧响应不覆盖新任务。
- 弹窗关闭后任务状态存 session，重开可恢复；无法恢复时明确提示重新提交。
- 不申请 `tabs`/`activeTab`/`scripting`/`cookies`/`webRequest`/`unlimitedStorage`/`content_scripts`/`<all_urls>` 权限。
- 安全审查不访问 URL、不查信誉、不扫文件；提示语必含不确定性；输出必须包含固定免责声明“基于所选文本的辅助判断，不构成安全保证。”。
- 非 info 级 finding 必须有非空 evidence 且为原文精确子串；仅 info 信息提示允许空 evidence。无依据时不得生成风险结论。
- 发布 ZIP 不含 node_modules、测试 profile、trace、环境文件、真实 Key。

## 11. 内嵌已知坑（从代码基线审查提取）

| 坑 | 位置 | 根因 | 修法 |
|----|------|------|------|
| 选中文本打进 console | background.js:14 | 调试残留，泄露网页内容 | 删除该日志；生产零日志 |
| Mock"分析完成"误导 | popup.js:8 | 固定文案冒充真实结果 | 删除；改为状态驱动，演示须标注 |
| innerHTML 渲染结果 | popup.js:8 | 未来模型输出会成注入点 | 统一 textContent / 文本节点 |
| openPopup 无 catch | background.js:17 | 非用户手势调用会 reject | 加 catch，提示手动点扩展图标 |
| 正文持久写 local | background.js:16 | 离线隐私目标 | 改 session；迁移时删除旧 lastSelectedText |
| body width+padding 超宽 | popup.html:7-12 | content-box 叠加 | box-sizing:border-box |
| 缺 lang/h1/label | popup.html:1-3 | 无障碍基线不足 | 补 lang="zh-CN"、唯一 h1、可见 label |
| README 不存在 | 全目录 | 与交接文档描述不符 | Phase 3 必须补齐 |

## 12. 端到端验证步骤（Spec 锁定）

```bash
# 1. 安装依赖（开发依赖仅测试/图标用）
cd D:\gemini-summary-ext
npm ci
npx playwright install chromium

# 2. 自动化测试（默认离线，无真实 Key）
npm test

# 3. 人工冒烟（Chrome >= 127，开发者模式加载 unpacked）
#    a. 划词→右键→弹窗打开，确认"未发送网络请求"
#    b. 未配置 Key 点分析 → 本地提示，网络请求 0
#    c. 虚构 Key + Mock 验证：成功/401/403/429/超时/非法响应/取消
#    d. 检查 local 无正文、sync 无 Key/正文、无日志含敏感值、XSS 文本纯渲染
#    e. 关闭重开弹窗，任务状态可恢复；重启浏览器 Key 已清除
#    f. （OPEN-001 解除后）用户本地真实 Key 跑一次最小请求，记录脱敏状态
#    g. 打包前核对 ZIP 无 node_modules/trace/Key
```

完成定义：`npm test` 全绿；人工成功流 + 至少 403/超时两条错误流符合契约；真实 API 未获资格时保留 blocked 标记，不伪造通过。

## 13. 变更记录

| 日期 | 变更内容 | 原因 | 影响范围 |
|------|---------|------|---------|
| 2026-10-26 | 初版 Spec 生成 | 三文档用户确认 + 三项冲突锁定 | 全项目 |
| 2026-10-26 | 输入上限锁定 10,000 字符 | 用户决策 | AC-12、测试边界 |
| 2026-10-26 | Key 仅 session、日志零持久 | 用户决策 | AC-02/03/13、存储矩阵 |
