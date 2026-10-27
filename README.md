# Gemini 极简速审助手

> Chrome 划词速审扩展——对选中文本执行摘要、安全审查辅助或中英翻译。  
> BYOK 自带 Key，结果可核对，失败不伪装，隐私边界清晰。

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue) ![Chrome 127+](https://img.shields.io/badge/Chrome-127%2B-green) ![Tests 86/86](https://img.shields.io/badge/Tests-86%2F86-brightgreen) ![Version](https://img.shields.io/badge/version-0.9.0--preview-orange)

---

## ⚠️ 当前版本状态：0.9.0-preview（预发布）

**本版本不是 v1.0.0，真实 Gemini API 调用尚未验收。**

| 项 | 状态 | 说明 |
|---|---|---|
| 扩展加载与 UI 流程 | ✅ 已验证 | 86 项自动化测试全绿（单测 71 + E2E 15） |
| 三模式提示词与结果校验 | ✅ 已验证 | Mock 响应下全路径通过 |
| BYOK 会话存储与清除 | ✅ 已验证 | 仅 `chrome.storage.session`，测试覆盖 |
| 错误分类（401/403/404/429/超时/网络/格式） | ✅ 已验证 | Mock 响应下分类正确，不伪造成功 |
| **真实 API 推理** | ❌ **未验收** | 当前 Google Cloud 项目报 403 免费层不可用（OPEN-001） |
| **默认模型 `gemini-3.8-flash`** | ❌ **未实测** | 仅为官方文档候选值，未经真实推理确认（OPEN-002） |

按本项目 PRD 发布门槛（[`docs/PRD.md`](docs/PRD.md) §12）：**三种模式均需至少一条真实 API 成功记录，才能标记 v1.0.0**。当前阻塞未解除，因此版本号保持 `0.9.0-preview`，Release 标记为 Pre-release。离线演示可完整跑通，但**全程标注"非 Gemini API 结果"**。

> 发布门槛原文：*"若官方资格仍阻塞，则版本只能标为演示/预发布，不得伪装完整 v1.0.0。"*

---

## 功能总览

| 模式 | 输入 | 输出 |
|------|------|------|
| **摘要** | 有明确论点的文本 | 3–5 条要点；信息不足时明确提示，不补造内容 |
| **安全审查** | 任意选中文本 | 风险类型、原文依据、判断理由、不确定性、建议动作 |
| **翻译** | 中文或英文 | 完整译文，数字与代码语义不变 |

核心特性：

- **三种触发方式**：右键菜单 / 快捷键 `Ctrl+Shift+S` / 点扩展图标自动捕获
- **BYOK**：API Key 仅保存到浏览器会话，关浏览器即清除
- **离线演示**：无 Key 时可体验完整 UI 流程，全程标注"非 Gemini API 结果"
- **安全渲染**：模型输出按纯文本展示，含 HTML/脚本也不会执行
- **零日志**：生产环境不记录原文、Key、请求头或完整响应

---

## 快速开始

### 1. 安装

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 开启右上角 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**，选择本项目目录
4. 扩展图标出现在工具栏

### 2. 配置 API Key

1. 在任意网页**划选一段文字**
2. 用任意方式打开弹窗（点图标 / 快捷键 / 右键）
3. 点击右上角 **设置按钮**
4. 粘贴你的 Gemini API Key → 点 **"保存到本次会话"**

> 获取 Key：[Google AI Studio](https://aistudio.google.com/apikey)

### 3. 开始使用

划选文字 → 选择模式 → 点击主按钮 → 查看结果

---

## 三种触发方式

| 方式 | 操作 | 步骤 |
|------|------|------|
| **右键菜单** | 划词 → 右键 → "使用 Gemini 速审这段内容" | 3 步 |
| **点图标** | 划词 → 点工具栏扩展图标 | 2 步 |
| **快捷键** | 划词 → 按 `Ctrl+Shift+S`（Mac: `Cmd+Shift+S`） | 2 步，最快 |

> 快捷键可在 `chrome://extensions/shortcuts` 中自定义。  
> 三种方式都只捕获你**主动选中的文字**，不读取整页内容或浏览历史。

---

## 权限说明

| 权限 | 用途 | 何时触发 |
|------|------|---------|
| `contextMenus` | 注册右键菜单 | 右键时 |
| `storage` | 保存会话 Key、任务状态、非敏感偏好 | 使用中 |
| `activeTab` | 临时访问当前标签页，读取选中文本 | 你主动调用扩展时（点图标/快捷键/右键） |
| `scripting` | 在当前页面执行脚本读取选中文本 | 同上 |
| `host_permissions: generativelanguage.googleapis.com` | 调用 Gemini API | 点击"分析"按钮时 |

**不会做的事**：读取浏览历史、后台访问网页、采集用户行为、上传选中文本到第三方服务器。

---

## 错误排查

| 界面提示 | 含义与下一步 |
|----------|-------------|
| 需要先配置 API Key | 打开设置保存 Key 后重试 |
| API Key 未通过验证（401） | 检查 Key 是否正确；仍失败时到官方后台确认 |
| 当前项目无法调用此 API（403） | 项目免费层资格/地区/模型权限问题；查看官方文档。不提供跨区绕过建议 |
| 所选模型不可用（404） | 模型候选未经真实推理验证；在官方后台确认可用模型 |
| 请求频率或项目额度暂时受限（429） | 稍后重试，或查看官方额度说明 |
| 等待超过 30 秒，本次请求已停止 | 可手动重试 |
| 无法连接 Gemini API，请检查网络 | 检查网络后重试；也可进入离线演示 |
| 服务返回的内容无法识别 | 响应校验失败，重试；持续出现请保留脱敏诊断类别 |
| 已选 N 字，超过 10,000 字上限 | 缩短选区后重试 |
| 上次任务状态无法恢复，请重新提交 | 弹窗关闭期间任务中断，重新提交 |

---

## 限制（MVP 边界）

- **真实 API 未验收**：默认模型候选 `gemini-3.8-flash`（未经真实推理验证），项目免费层资格与模型可用性需实际调用确认。403 不等于 Key 格式或模型下线问题。
- 仅 Chrome（≥ 127）中文界面。
- 无整页抓取、PDF/OCR、对话追问、自定义提示词、多模型、历史记录、账户同步。
- 安全审查只做**文本级**风险信号辅助判断：不访问 URL、不查信誉、不扫文件；不构成安全保证。
- 结果由生成式模型产出：结构化输出降低格式波动，不保证事实正确，请核对后再采用。

---

## 安全与隐私

| 措施 | 说明 |
|------|------|
| 存储矩阵 | Key 与正文仅存 `chrome.storage.session`（关浏览器即清）；`storage.local` 只存模式/翻译方向；`storage.sync` 不存任何敏感数据 |
| 零持久日志 | 不打印/不持久记录原文、Key、请求头、完整响应 |
| 安全渲染 | 一律 `textContent`，禁止 `innerHTML` 渲染动态内容 |
| 图标规范 | Lucide 本地静态 SVG（ISC 许可），无 emoji 功能图标 |
| BYOK 边界 | Key 存在浏览器扩展上下文中，不能宣称"不可提取"；清除本扩展 Key 不会撤销服务商后台的密钥 |

> 请勿提交密码、密钥、身份证件、未公开资料或他人敏感信息。

---

## 测试

```bash
npm ci                           # 安装测试依赖
npx playwright install chromium  # 安装 Playwright 浏览器
npm test                         # 运行全部测试（离线，无需真实 Key）
```

| 测试类型 | 命令 | 覆盖范围 |
|---------|------|---------|
| 单元测试 | `npm run test:unit` | 提示词三模式、结果校验、错误映射、输入边界、API 契约、存储、源码卫生（零 console / 零 innerHTML） |
| E2E 测试 | `npm run test:e2e` | BYOK 流程、三模式、错误分类、XSS 渲染、离线演示、取消 |
| 真实冒烟 | `npm run test:live` | 真实 API 调用（默认跳过，需 `RUN_LIVE_GEMINI=1` + `GEMINI_API_KEY`） |

**测试结果：86/86 通过**（单测 71 + E2E 15）

### 人工冒烟清单

1. 划词 → 点图标：确认文字自动带入
2. 按 `Ctrl+Shift+S`：确认快捷键触发弹窗
3. 未配置 Key 点分析：本地提示，零网络请求
4. 三模式各跑一次（离线演示）：确认结果标注来源
5. 关闭重开弹窗：任务状态可恢复
6. 重启浏览器：会话 Key 已清除

---

## 目录结构

```
gemini-summary-ext/
├── manifest.json              # MV3 配置（权限、快捷键）
├── background.js              # Service Worker 装配入口
├── popup.html / popup.js      # 弹窗入口
├── styles/popup.css           # Design Token + 样式
├── assets/icons/              # Lucide 本地 SVG + 许可
├── src/
│   ├── background/            # controller / menu / message-router
│   ├── services/              # prompt-builder / analysis-service / result-validator / error-mapping
│   ├── infrastructure/        # gemini-client / key-store / task-store
│   ├── contracts/             # messages / result-schema
│   ├── config/                # defaults.js（模型/上限/超时）、demo-samples.js（离线演示样例）
│   └── ui/                    # popup-view（状态机）/ popup-render（安全 DOM）
├── tests/
│   ├── fixtures/              # 固定测试样例
│   ├── unit/                  # 单元测试（71 例）
│   ├── e2e/                   # Playwright E2E（15 例）
│   └── live/                  # 真实 API 冒烟（默认跳过）
├── package.json
└── README.md
```

---

## 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 运行时 | 原生 JavaScript ES modules | 零依赖，直接加载 |
| 平台 | Manifest V3 | Chrome 扩展当前标准 |
| API | Gemini Interactions API | 2026-06 起官方默认接口 |
| 存储 | `chrome.storage.session` | 敏感数据不落盘 |
| 测试 | `node:test` + Playwright | 零依赖单测 + 真实浏览器 E2E |
| 图标 | Lucide 本地 SVG | 统一描边，无运行时 |

---

## 开源许可

代码：MIT  
图标：[Lucide ISC License](assets/icons/LICENSE)  
更新日志：[CHANGELOG.md](CHANGELOG.md)
