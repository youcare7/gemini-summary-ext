# Gemini 极简速审助手：目标架构与技术契约

- 基线日期：2026-10-26
- 文档状态：Phase 1 调研结论，供 Phase 2 实施使用
- 源码范围：`D:\gemini-summary-ext`
- 变更边界：本次仅静态检查和联网调研，未修改扩展源码，未调用真实 Gemini API，未读取或记录真实 Key

## 1. 结论与放行条件

推荐保留现有 Manifest V3、原生 HTML/CSS/JavaScript 和右键菜单入口，在扩展 Service Worker 内直接调用 Gemini Interactions REST API。API Key 默认仅放入 `chrome.storage.session`；只有用户明确选择“记住 Key”并看到未加密风险提示后，才允许写入 `chrome.storage.local`。不引入前端框架、后端、数据库、内容脚本或远程代码。

当前项目级 403 不能靠换模型、重建 Key 或改用 `models.list` 解决。官方排障文档说明，免费层资格按 Google Cloud 项目评估；同一项目新建 Key 无效，`models.list` 返回 200 也不证明推理权限可用。因此，真实 API 验收仍受外部资格条件阻塞，详见 `decisions/OPEN-DECISIONS.md`。这不阻塞离线实现、Mock 测试和明确标注的本地演示。

Phase 2 可以实施扩展逻辑，但不得宣称“真实 Gemini 已验收”，直到同一项目、同一 Key 的一次最小 Interactions 推理请求成功。

## 2. 调研证据边界

已执行：

- 逐个读取扩展目录内全部 4 个文件；目录中没有其他文件、README、测试或依赖清单。
- `node --check` 通过 `background.js` 与 `popup.js`；`manifest.json` 可解析为合法 JSON。
- 本机版本为 Node.js `v22.22.2`、npm `10.9.7`。
- 通过 npm registry 核验 `@playwright/test@1.64.1` 与 `lucide-static@1.61.0` 存在且可解析。
- 查阅 Chrome Extensions、Gemini API、Playwright 和 Lucide 官方资料；链接见第 15 节。

未执行：

- 未在 Chrome 中重新加载扩展，故右键和弹窗行为只有代码证据，没有本轮运行证据。
- 未使用真实 Key，未复现 403，未验证任何项目实际可用模型。
- 未访问 GitHub 仓库，不能断言本地与远端一致。

## 3. 当前代码基线与差距

| 证据 | 已确认事实 | 架构影响 |
|---|---|---|
| `D:\gemini-summary-ext\manifest.json:2,10-15` | 已是 Manifest V3，入口为 Service Worker 和 popup | 保留平台与入口，不做迁移重写 |
| `manifest.json:6-9` | 仅声明 `contextMenus`、`storage` | 权限基线良好；直连 Gemini 仍需新增单一主机权限 |
| `manifest.json:13-15` | 声明默认 popup，没有 `minimum_chrome_version` | 使用 `openPopup` 时需明确 Chrome 127 下限 |
| `background.js:2-8` | 安装时注册选中文本右键菜单 | 无需内容脚本即可取得 `selectionText` |
| `background.js:11-18` | 菜单点击后写 `storage.local`，再调用 `openPopup` | 当前只有“捕获文本”流，没有请求、任务状态或失败处理 |
| `background.js:14` | 将用户选中文本写入控制台 | 删除该日志，避免泄露网页内容和隐私 |
| `background.js:16` | 选中文本持久保存在本地存储 | 改为会话级任务数据；不持久保存正文 |
| `background.js:17` | 未处理 `openPopup` Promise 拒绝 | 增加失败处理，并保留“用户手动点扩展图标”路径 |
| `popup.js:1-12` | 只读取 `lastSelectedText` 并更新 DOM | 没有消息协议、BYOK、模式、加载态和错误态 |
| `popup.js:8` | 显示固定“分析完成”文本 | 当前是 Mock，不是 Gemini 结果；必须显著标注，不能在失败时自动展示 |
| `popup.js:8` | 使用 `innerHTML` 写结果 | 当前值虽为常量，未来接入模型后会成为注入风险；统一改为 `textContent` 和安全 DOM 构建 |
| `popup.html:51-60` | 只有来源和结果两个区域 | 需要补充模式、目标语言、设置、操作和状态区 |
| `D:\gemini-summary-ext` 全目录 | README 不存在，与交接文档的描述不一致 | 实施阶段必须补齐安装、限制、测试与隐私说明 |
| `D:\gemini-summary-ext` 全目录 | 无测试、fixtures、`package.json`、图标资源 | 需要建立可复现测试和本地 SVG 资源 |

当前数据流：

```text
网页选中文本
    |
    v
contextMenus.onClicked
    |
    +--> console.log（应删除）
    |
    v
chrome.storage.local.lastSelectedText
    |
    v
popup.js 读取并显示固定 Mock 文本
```

## 4. 方案比较与选型

评分采用 1 至 5 分，5 分为相对最优；“安全”在此仅比较本项目的攻击面，不代表浏览器端可以绝对保密 BYOK。

| 方案 | 学习与维护 | Key 与隐私边界 | 弹窗生命周期适应 | 部署成本 | 可测试性 | 总分 / 25 | 结论 |
|---|---:|---:|---:|---:|---:|---:|---|
| A. Service Worker 直连 REST | 5 | 4 | 5 | 5 | 5 | 24 | 采用 |
| B. popup 直连 REST | 5 | 2 | 2 | 5 | 3 | 17 | 不采用 |
| C. 自建后端代理 | 2 | 3 | 4 | 1 | 3 | 13 | MVP 不采用 |

### 方案 A：Service Worker 直连 REST

- 请求只发往 `https://generativelanguage.googleapis.com`。
- popup 只负责输入、展示和发送内部消息；网络、重试、超时和错误归一化集中在 Service Worker。
- 弹窗关闭后，任务状态与最终结果仍可写入 `storage.session`，下次打开可恢复。
- 无服务器费用、无自建密钥托管、无额外隐私接收方。
- 限制：Key 仍存在于用户浏览器的扩展上下文中，不能宣称“不可提取”。

### 方案 B：popup 直连 REST

优点是少一层消息，但 popup 失焦会关闭，DOM 上下文直接接触 Key 和响应，生命周期、错误恢复和测试都更差，不选。

### 方案 C：自建后端代理

开发者自有 Key 的服务化产品可从代理隐藏 Key，但本项目是 BYOK；代理会额外接收用户 Key 与网页正文，增加部署、日志脱敏、认证、滥用控制和持续费用。它也不能解决用户项目自身的免费层资格，不选。

## 5. 目标分层架构

```text
+-------------------------------------------------------+
| 表现层：popup.html / popup.js / src/ui                 |
| 设置、模式、目标语言、状态展示；不 fetch、不存业务规则  |
+--------------------------+----------------------------+
                           | chrome.runtime 消息
                           v
+-------------------------------------------------------+
| 应用层：src/background / src/services                  |
| 菜单编排、请求 ID、取消、提示词、结果校验、错误映射      |
+--------------------------+----------------------------+
                           |
              +------------+-------------+
              |                          |
              v                          v
+-------------------------+  +--------------------------+
| 基础设施：Gemini REST   |  | 基础设施：Chrome Storage |
| 单主机 HTTPS、超时重试  |  | Key、偏好、会话任务状态  |
+-------------------------+  +--------------------------+
              |
              v
https://generativelanguage.googleapis.com/v1beta/interactions
```

核心序列：

```text
用户划词并点击菜单
  -> background 将 selectionText 写入 session.pendingAnalysis
  -> 尝试 openPopup；失败则提示用户点击扩展图标
  -> popup 读取 pendingAnalysis，只显示原文，不自动发送
  -> 用户选择模式并点击“开始分析”
  -> popup 发送 ANALYZE_REQUEST(requestId, mode, text, targetLanguage)
  -> Service Worker 读取 Key，构造提示词，调用 Interactions API
  -> 校验 HTTP、Interaction steps 和模型 JSON
  -> session 保存去敏任务结果，返回 ANALYZE_RESPONSE
  -> popup 按 requestId 接收并渲染，过期响应丢弃
```

“用户点击开始后才发送正文”是隐私硬约束；划词和打开设置不得触发 Gemini 请求。

## 6. 可执行目录与文件组织约束

以下为 Phase 2 目标结构，不要求机械创建空目录：

```text
D:\gemini-summary-ext\
  manifest.json
  background.js                 # 仅装配事件和路由，少于 100 行
  popup.html
  popup.js                      # 仅装配 UI，少于 100 行
  package.json
  package-lock.json
  playwright.config.js
  README.md
  styles\
    popup.css
  assets\icons\                 # 仅使用到的本地 Lucide SVG 与许可声明
  src\
    background\
      controller.js
      menu.js
      message-router.js
    services\
      analysis-service.js
      prompt-builder.js
      result-validator.js
    infrastructure\
      gemini-client.js
      key-store.js
      task-store.js
    contracts\
      messages.js
      result-schema.js
    config\
      defaults.js
    ui\
      popup-view.js
  tests\
    fixtures\
    unit\
    e2e\
    live\
```

硬规则：

- 原生 JavaScript ES modules；`background.service_worker.type` 设为 `module`，popup 使用 `type="module"`。
- 每个源文件一个主职责，非空非注释行不超过 300；入口只装配。
- UI 不得直接调用 Gemini；Gemini client 不得操作 DOM；存储模块不得包含提示词业务。
- 所有消息和结果 Schema 独立放在 `contracts`。
- 不引入 React、Vue、Tailwind、打包器或运行时 npm 依赖。
- `@playwright/test` 和 `lucide-static` 仅为开发依赖；发布 ZIP 不含 `node_modules`、测试配置和真实用户数据。

## 7. Manifest 与权限最小化契约

目标权限仅如下：

```json
{
  "minimum_chrome_version": "127",
  "permissions": ["contextMenus", "storage"],
  "host_permissions": ["https://generativelanguage.googleapis.com/"]
}
```

依据：

- Chrome 官方跨源请求文档要求扩展 Service Worker 或扩展页面跨源 fetch 时声明主机权限；应使用单一主机而非通配符。
- `chrome.action.openPopup()` 从 Chrome 127 起向普通扩展开放，故将 127 作为下限，避免旧版本静默不兼容。
- 选中文本来自 `contextMenus` 事件，不需要读取标签页或注入脚本。

明确禁止新增：`tabs`、`activeTab`、`scripting`、`cookies`、`webRequest`、`unlimitedStorage`、`content_scripts`、`<all_urls>`、通配主机权限。若未来需求确需其中任何一项，必须单独 ADR 评审。

## 8. BYOK、正文与状态存储

### 8.1 存储矩阵

| 数据 | 默认位置 | 生命周期 | 约束 |
|---|---|---|---|
| `geminiApiKey` | `chrome.storage.session` | 浏览器/扩展会话 | 默认不落盘，不写日志 |
| 可选持久 Key | `chrome.storage.local` | 用户明确选择后持久 | 显示“本地未加密”风险；提供清除按钮 |
| 模式、目标语言、是否记住 Key | `chrome.storage.local` | 持久 | 仅非敏感偏好 |
| 选中文本、加载态、结果 | `chrome.storage.session` | 会话 | 不进入 local/sync，不写日志 |
| 任何 Key 或正文 | `chrome.storage.sync` | 禁止 | 不同步到其他设备 |

Chrome 官方文档指出 local/sync 不应保存机密数据，因为未加密，并建议敏感数据使用 session；session 默认不暴露给内容脚本。实施时对 local 和 session 均设置 `TRUSTED_CONTEXTS`，即使当前没有内容脚本也保持最小暴露。

### 8.2 Key 操作契约

- 输入框使用 `type="password"`，默认不显示完整值。
- “保存”只发送一次受信任扩展内部消息；Service Worker 立即写入所选存储区，消息和异常均不打印。
- “清除 Key”同时移除 local 与 session 中的 Key，并取消进行中的请求。
- 禁止将 Key 放入 URL query、源码、fixtures、测试快照、Playwright trace、README、Issue、GIF 或截图。
- 不用“已安全加密”“无法被读取”等文案。BYOK 是用户自管凭据，不是客户端绝对保密方案。
- 初始升级时删除旧 `lastSelectedText` 本地持久数据，不迁移正文。

## 9. Gemini API 契约

### 9.1 接口选择

采用官方当前推荐的新项目接口：

```text
POST https://generativelanguage.googleapis.com/v1beta/interactions
x-goog-api-key: 用户本地提供的 Key
Content-Type: application/json
Api-Revision: 2026-05-20
```

Interactions API 自 2026 年 6 月 GA 并被官方推荐给新项目；`generateContent` 仍受支持但已被标记为 legacy。当前扩展尚无既有 API 调用，因此无需从旧接口迁移。

请求固定 `store=false`、`stream=false`，不使用 `previous_interaction_id`、后台任务、工具、搜索 grounding 或 URL context。`store=false` 只关闭 Interaction 对象的服务端存储和后续状态引用，不能被描述为“Google 不处理或不保留任何数据”。

机器可读的当前请求子集见 `docs/openapi.yaml`；它是外部 Gemini API 的项目级契约，不是自建后端 API。

### 9.2 请求体

```json
{
  "model": "gemini-3.8-flash",
  "system_instruction": "由 prompt-builder 生成的任务规则",
  "input": "用户明确提交的选中文本",
  "store": false,
  "stream": false,
  "generation_config": {
    "max_output_tokens": 2048
  },
  "response_format": {
    "type": "text",
    "mime_type": "application/json",
    "schema": "引用 contracts/result-schema.js 中的对象"
  }
}
```

`gemini-3.8-flash` 是依据 2026-10-26 官方文档示例（`ai.google.dev/gemini-api/docs` 首页与 Interactions Overview 均使用此模型名）选出的候选默认值。它不是当前项目的已验证可用结论。不得采用交接文档中“旧模型全部下线”或“某模型必然需要付费”的推断。最终默认值需由 `OPEN-002` 的真实推理测试确认。

不自动切换到其他模型，尤其不得静默切到付费模型。模型不可用时显示配置错误，由用户从经过验证的候选列表中选择。

### 9.3 结果 Schema

三种模式共用一个严格校验的传输形状：

```json
{
  "mode": "summary | security | translate",
  "output": "摘要、总体风险说明或完整译文",
  "findings": [
    {
      "severity": "info | low | medium | high",
      "category": "风险类别",
      "evidence": "来自输入的短引文；没有则为空字符串",
      "recommendation": "可执行建议"
    }
  ]
}
```

- `mode`、`output`、`findings` 必填；摘要与翻译的 `findings` 必须为空数组。
- 安全审查只允许 `security` 模式返回 findings；`evidence` 必须能在原文中找到，否则该条结果判为无效，不展示虚构依据。
- 安全结果固定附带“基于所选文本的辅助判断，不构成安全保证”；没有足够证据时要求输出“无法判断”，不得给出“绝对安全”。
- 翻译至少支持 `zh-CN` 与 `en`，完整译文放 `output`，保留原有段落语义。
- 选中文本始终作为不可信数据引用，不能覆盖系统指令；不启用工具，因此文本中的“调用工具/访问网址”不会被执行。
- 客户端仍需 `JSON.parse`、字段类型、长度、枚举和 evidence 校验。结构化输出降低格式波动，不等于事实正确。

### 9.4 响应提取

按 2026-05-20 后的 `steps` 架构处理，不读取旧 `outputs`：

```text
response.steps[]
  -> 筛选 type == "model_output"
  -> 取最后一个该步骤
  -> 在 content[] 中筛选 type == "text"
  -> 合并 text 字段
  -> JSON.parse 并按结果 Schema 校验
```

`status` 非 completed、没有文本、多个步骤结构异常或 JSON 无效均返回 `MALFORMED_RESPONSE`，不得把空内容当成功。

### 9.5 输入限制与并发

- trim 后为空：本地 `EMPTY_INPUT`，不请求 API。
- 上限 12,000 个 UTF-16 code units；超限要求用户缩短选择，不静默截断。
- 同一用户只允许一个活动分析；新请求通过 `AbortController` 取消旧请求。
- 每个请求带 `crypto.randomUUID()` 形式的 `requestId`；popup 只渲染当前 ID 的响应。
- 单次请求超时 30 秒；408、429、500、502、503、504 和可恢复网络错误最多重试 2 次，使用 1 秒起步、上限 8 秒的指数退避加抖动；总预算 90 秒。
- 400、401、403、404 不自动重试。429 若无短期重试价值，展示配额稍后再试，不无限轮询。

## 10. 内部消息与错误契约

请求：

```json
{
  "type": "ANALYZE_REQUEST",
  "requestId": "uuid",
  "mode": "summary | security | translate",
  "text": "string",
  "targetLanguage": "zh-CN | en，仅 translate 需要"
}
```

成功响应：

```json
{
  "type": "ANALYZE_RESPONSE",
  "requestId": "uuid",
  "ok": true,
  "result": "按第 9.3 节校验的对象",
  "meta": { "model": "实际请求模型", "demo": false }
}
```

失败响应：

```json
{
  "type": "ANALYZE_RESPONSE",
  "requestId": "uuid",
  "ok": false,
  "error": {
    "kind": "MISSING_KEY | INVALID_KEY | INVALID_REQUEST | PERMISSION_DENIED | MODEL_UNAVAILABLE | RATE_LIMITED | TIMEOUT | NETWORK | UPSTREAM_UNAVAILABLE | CONTENT_BLOCKED | MALFORMED_RESPONSE | EMPTY_INPUT | INPUT_TOO_LONG | CANCELLED",
    "status": 0,
    "retryable": false,
    "message": "面向用户的具体原因与下一步"
  }
}
```

错误映射要求：

| 条件 | kind 与 UI 下一步 |
|---|---|
| 未配置 Key | `MISSING_KEY`，打开设置；不发请求 |
| 400 且安全/内容阻止 | `CONTENT_BLOCKED`，调整输入；不显示被阻止内容 |
| 其他 400 | `INVALID_REQUEST`，显示脱敏服务端 message，不自动重试 |
| 401 | `INVALID_KEY`，重新填写；不自动重试 |
| 403 免费层不可用文案 | `PERMISSION_DENIED`，说明项目无免费层资格；不归因于模型或 Key 格式 |
| 其他 403 | `PERMISSION_DENIED`，检查项目、Key 状态与模型权限 |
| 404 | `MODEL_UNAVAILABLE`，选择已验证模型 |
| 429 | `RATE_LIMITED`，稍后重试或检查 AI Studio 配额 |
| 超时/网络 | `TIMEOUT` 或 `NETWORK`，允许用户手动重试 |
| 5xx | `UPSTREAM_UNAVAILABLE`，按退避结果提示稍后重试 |
| steps 或 JSON 无效 | `MALFORMED_RESPONSE`，保留“请求失败”状态，不伪造结果 |

日志仅允许记录 `requestId`、模型、HTTP 状态、内部错误 kind 和耗时；禁止记录 Key、请求头、完整正文、完整响应和完整 URL query。

## 11. API 不可用时的降级

降级必须显式，不得自动用 Mock 替代失败请求：

1. 默认仍展示已选文本、模式说明和真实错误；摘要、安全审查和翻译不伪造成功。
2. 提供独立“本地演示”入口，只加载 `tests/fixtures` 的固定结果，界面和导出均标注“本地演示，非 Gemini 结果”，`meta.demo=true`。
3. 真实请求失败后保持错误状态，由用户主动切换到演示；切换动作要清除“真实结果”标记。
4. 无网络时仍可运行单元测试、Playwright Mock 端到端测试和本地演示。
5. 本轮不引入 Chrome 内置 AI、第三方模型、代理或跨区网络作为隐式替代；这些属于独立产品和合规决策。

免费层价格页还说明免费层内容可能用于改进产品，因此 README 和设置页必须提示：不要提交密码、密钥、身份证件、未公开资料或他人敏感信息；`store=false` 不改变这一提示。

## 12. SVG 图标与界面技术约束

锁定 `lucide-static@1.61.0`，只将实际使用的 SVG 复制到 `assets/icons` 并保留 ISC/MIT 许可声明；运行时不加载 Lucide JavaScript、不访问 CDN、不增加框架依赖。许可依据见 Lucide 官方许可页。

首批图标限定为 `settings`、`key-round`、`play`、`square`、`trash-2`、`circle-alert`、`check`、`loader-circle`。统一 16 或 20 px、`currentColor`、相同 stroke width；装饰图标 `aria-hidden="true"`，纯图标按钮必须有可访问名称。功能图标不得使用 emoji 或其他图标库混画。

界面沿用现有中性色与 Google 蓝单色，不引入渐变。模型文本只用 `textContent` 或显式创建文本节点，禁止 `innerHTML`、远程脚本和内联事件处理器。

## 13. 可复现测试策略

### 13.1 版本与依赖

```text
运行时：Chrome >= 127，Manifest V3，原生 JavaScript ES modules
本机基线：Node.js 22.22.2，npm 10.9.7
单元测试：Node.js 内建 node:test，无测试框架依赖
浏览器测试：@playwright/test 1.64.1，精确 devDependency + package-lock
图标资产来源：lucide-static 1.61.0，精确 devDependency，发布时只带本地 SVG
```

Playwright 官方要求扩展测试使用 persistent context，并使用其捆绑 Chromium 的 `chromium` channel；测试按此配置，不依赖用户本机 Chrome 路径。

### 13.2 分层测试

| 层 | 工具 | 必测内容 |
|---|---|---|
| 纯单元 | `node:test` | 三种提示词、输入边界、evidence 校验、错误映射、退避、取消、requestId 竞态 |
| API 契约 | 注入 fake fetch | 精确端点、Header、`store=false`、steps 提取、异常 JSON；断言日志无敏感值 |
| Storage | 内存 Chrome mock | session 默认、显式持久化、双区清除、旧正文清理、trusted access |
| 扩展 E2E | Playwright persistent Chromium | 扩展加载、Service Worker、popup 设置、三种模式、Mock 网络错误、XSS 文本安全渲染 |
| 真实冒烟 | 独立 live 测试，默认跳过 | 同一项目一次最小推理与三模式各一次；只由用户在本地执行 |

E2E 使用 Playwright `context.route` 拦截 Service Worker 发往 Gemini 主机的请求，返回 fixtures；测试 Key 统一为明显虚构值，trace 中也不得出现真实凭据。原生操作系统右键菜单的最终点击保留人工冒烟步骤，不用脆弱的屏幕坐标自动化。

默认测试不访问真实 Gemini。live 测试必须同时设置 `RUN_LIVE_GEMINI=1` 和用户本机环境变量，且只输出状态码、模型和脱敏错误；在 `OPEN-001` 未解除前允许记录为 blocked，不允许改成假通过。

### 13.3 最小回归集

- 摘要、安全审查、中译英、英译中各一个固定输入。
- 空文本、12,000 边界、超长文本、换行与 Unicode。
- 缺少 Key、401、两类 403、404、429、500、503、超时、断网、取消和旧响应覆盖新响应。
- `steps` 缺失、无 model_output、无 text、非法 JSON、字段缺失、伪造 evidence。
- 含 HTML 的模型结果显示为文本；含提示注入的原文不改变任务、不触发工具。
- API 失败时不出现 Mock 成功结果；本地演示始终有非 Gemini 标识。

## 14. 实施验收与成本边界

### 14.1 可执行端到端验证

在扩展目录完成 Phase 2 实施后：

```bash
npm ci
npx playwright install chromium
npm test
```

然后在 Chrome 127 或更高版本加载 unpacked 扩展，执行人工冒烟：

1. 选中固定公开测试文本，从右键菜单打开扩展；确认正文可见但尚未发网。
2. 未配置 Key 点击分析，确认本地提示且网络请求数为零。
3. 使用虚构 Key 和 Mock 环境分别验证成功、403、429、超时、非法响应和取消。
4. 检查 local 无正文、sync 无 Key/正文、日志无 Key/正文、模型文本按纯文本显示。
5. 关闭再打开 popup，确认当前任务状态可恢复；重新开始浏览器后 session Key 按预期清除。
6. 外部资格解除后，由用户本地输入真实 Key，运行一次真实最小请求；保存脱敏状态记录，不保存 Key 或完整响应。
7. 打包前核对 ZIP 不含 `node_modules`、测试 profile、trace、环境文件和真实 Key。

完成定义：默认自动化测试全绿，人工成功流和至少 403/超时两条错误流符合契约；真实 API 未获资格时必须保留明确 blocked，不得以此豁免或伪造。

### 14.2 成本估计

该架构无后端、数据库、域名和固定服务器成本；Gemini 费用由各 BYOK 用户项目承担，是否免费不能预先保证。基于当前仅 4 个源码文件且保留原生技术栈，合理实施量为 5 至 8 个开发日：BYOK 与状态 1 日、API 与三模式 2 至 3 日、测试 1.5 至 2 日、文档和发布核验 0.5 至 1 日。外部 API 资格等待不计入开发日。

## 15. 官方来源

以下外部事实均于 2026-10-26 对照官方资料：

1. Gemini API 首页与当前接口定位：<https://ai.google.dev/gemini-api/docs>
2. Interactions API 概览、GA、`store=false`、steps 与保留期：<https://ai.google.dev/gemini-api/docs/interactions-overview>
3. Interactions 2026-05 架构变化与 `Api-Revision`：<https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026?hl=zh-cn>
4. Interactions 结构化输出：<https://ai.google.dev/gemini-api/docs/interactions/structured-output>
5. 模型名称、稳定/preview 语义与弃用说明：<https://ai.google.dev/gemini-api/docs/models>
6. 免费层、价格与内容使用说明：<https://ai.google.dev/gemini-api/docs/pricing>
7. 项目免费层资格、`models.list` 局限和 REST 重试：<https://ai.google.dev/gemini-api/docs/troubleshooting?hl=zh-cn>
8. HTTP、生成阻止与错误结构：<https://ai.google.dev/gemini-api/docs/api-errors?hl=zh-cn>
9. 速率限制按项目和模型变化：<https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-cn>
10. 官方可用区域列表：<https://ai.google.dev/gemini-api/docs/available-regions?hl=zh-cn>
11. Chrome 跨源请求与主机权限：<https://developer.chrome.com/docs/extensions/develop/concepts/network-requests?hl=zh-cn>
12. Chrome Storage 生命周期和敏感数据建议：<https://developer.chrome.com/docs/extensions/reference/api/storage?hl=zh-cn>
13. Chrome `openPopup` 版本要求：<https://developer.chrome.com/docs/extensions/reference/api/action?hl=zh-cn>
14. Chrome 用户隐私与最小数据原则：<https://developer.chrome.com/docs/extensions/develop/security-privacy/user-privacy?hl=zh-cn>
15. Playwright Chrome 扩展测试：<https://playwright.dev/docs/chrome-extensions>
16. Playwright Service Worker 网络拦截：<https://playwright.dev/docs/service-workers>
17. Lucide SVG 与官方包：<https://lucide.dev/docs>
18. Lucide 许可：<https://lucide.dev/license>

## 16. 决策索引与明确不做

- `ADR-001`：Service Worker 直连 REST，不自建代理
- `ADR-002`：Interactions API、固定 revision、`store=false`
- `ADR-003`：BYOK 默认 session，持久化需明确选择
- `ADR-004`：原生 ES modules、Node 内建单测和 Playwright
- `ADR-005`：Lucide 本地静态 SVG，不引入 UI 框架

本次及 MVP 不包含：后端账号系统、数据库、同步 Key、历史记录云同步、自动模型付费切换、网页全文抓取、工具调用、搜索 grounding、流式 UI、多标签并发队列、跨浏览器适配、自动更新模型目录、任何跨区或绕过项目资格的做法。
