# Gemini 极简速审助手 MVP UI/UX 调研与交互规范

- 日期：2026-10-26
- 范围：现有 320px Chrome action popup 升级调研，不修改 `D:\gemini-summary-ext`
- 产品寄存器：Product
- 平台：Web / Chrome 扩展
- 设计刻度：`DESIGN_VARIANCE=2`、`MOTION_INTENSITY=2`、`VISUAL_DENSITY=6`
- 设计目标：三种固定任务、一次明确提交、结果与来源可核对、失败后可恢复

## 1. 证据边界

1. 已只读检查 `popup.html`、`popup.js`、`manifest.json`，并对照 `docs/PRD.md`。未修改现有扩展。
2. 指定知识库 `references/design-systems/token-standard.md` 已读取。
3. 指定行业文件 `references/industries/developer-tools.md` 不存在。已记录，未扫描插件目录，也未用其他行业文件冒充该文件。
4. 竞品调研覆盖 DeepL、Glasp、HARPA AI 的官方公开页面。本轮浏览器 CDP 授权连接未完成，未安装或实机操作竞品，因此只陈述公开文档能够证明的交互；未公开的加载、错误和密钥清除样式不做推断。
5. 下文“建议”“应当”“MVP 方案”属于本项目设计决策，不是对竞品或 Gemini API 现状的事实声明。模型、端点、错误码和官方 Key 获取链接由架构阶段另行核验。

## 2. 当前弹窗只读审查

### 2.1 可保留的基础

- `popup.html:7` 已以 320px 为目标宽度，符合小任务弹窗定位。
- `popup.html:22-32` 的原文区已有最大高度和独立滚动，适合保留“原文可核对”的思路。
- `popup.html:62` 使用外部 `popup.js`，符合 Chrome popup 脚本分离要求。[Chrome 官方说明](https://developer.chrome.com/docs/extensions/develop/ui/add-popup)
- 当前信息结构只有标题、原文、结果三部分，升级时无需引入路由库或组件框架。

### 2.2 必须修正的问题

| 位置 | 现状 | 影响 | MVP 修正 |
|---|---|---|---|
| `popup.html:6-12` | `body` 的 `width:320px` 与左右各 16px padding 按默认 content-box 叠加 | 实际布局宽度可能达到 352px | 全局设置 `box-sizing:border-box`，body 使用 `width:320px; margin:0` |
| `popup.html:11,16,23-24,34-35,43-44,56,59` | 组件和行内样式直接写颜色 | 无法统一主题和状态 | 原始值只存在于 Token 层，组件只引用语义 Token |
| `popup.html:35` | 结果区使用 4px 彩色左边框 | 视觉噪声较强，也不利于区分结果与警告 | 改为 1px 完整边框和背景层级，风险用文字与 SVG 图标表达 |
| `popup.html:27,37,42,56,59` | 10px、11px、12px 字号较多 | 320px 内阅读负担偏高 | 正文和结果 14px，标题 16px，元数据最低 12px |
| `popup.html:31` | `word-break:break-all` | 英文单词和代码可读性较差 | 改为 `overflow-wrap:anywhere`，保留正常单词断行 |
| `popup.html:53` | 固定显示“本地就绪” | 未配置 Key、请求失败时也会显得可用 | 状态由真实任务驱动；无状态时不放常驻徽章 |
| `popup.js:8` | 固定 Mock 结果显示“分析完成” | 容易把未调用模型的结果误认为真实成功 | 移除；离线演示必须持续标注“离线演示，非 Gemini API 结果” |
| `popup.html:33-40` | 结果区没有来源、时间、复制、失效状态 | 无法核对结果属于哪次任务 | 增加模式、来源、时间、复制及旧结果失效提示 |
| 整体 | 没有模式、BYOK、加载、取消、错误、设置和密钥清除流程 | 无法覆盖 MVP 主流程 | 使用同一 popup 内的主视图与设置视图完成，不增加框架 |
| `popup.html:1-3` | 缺少页面语言声明，标题与区域语义较弱 | 屏幕阅读器上下文不足 | 增加 `lang="zh-CN"`、唯一 `h1`、语义化区域和可见 label |

## 3. 三个相关产品的交互调研

### 3.1 DeepL 浏览器扩展

官方文档显示，划词译文出现在可移动的小窗口中；目标语言位于窗口顶部右侧，复制、收听、备选译文等后续操作围绕结果安排。未设置默认目标语言时，会在翻译前要求选择。设置独立分组；停用浮动图标时，用户需明确选择“当前网站”或“所有网站”并确认。[划词翻译流程](https://support.deepl.com/hc/en-us/articles/4407580229522-Translate-with-the-browser-extensions) [设置与停用确认](https://support.deepl.com/hc/en-us/articles/4407573357330-Accessing-the-settings-of-the-browser-extensions)

- 信息层级：结果优先，语言是关键上下文，复制等次级操作靠近结果。
- 空状态：缺少目标语言时先补齐必要配置，而非带着不完整配置直接执行。
- 成功状态：直接展示译文，并提供结果后续动作。
- 加载与错误：上述公开页面未给出足够的视觉细节，本调研不作推断。
- 可借鉴：主结果先于高级设置；影响范围不同的操作要明确确认。
- 不照搬：MVP 不做拖动浮窗、发音、术语表、备选译文和整页翻译。

### 3.2 Glasp

Glasp 官方教程说明，AI 摘要依赖用户的高亮和笔记；没有高亮时不能查看该摘要。摘要可从扩展侧栏或网站弹窗查看，结果弹窗右上角提供复制和分享。[官方摘要教程](https://glasp.co/posts/d071dffb-b9bd-43f4-87da-39749cbc2c99)

- 信息层级：先收集高亮，再生成摘要，最后复制或分享。
- 空状态：缺少高亮时摘要入口不可用，前置条件非常明确。
- 成功状态：结果可以复制到其他笔记工具。
- 加载与错误：上述公开教程没有完整说明，本调研不作推断。
- 可借鉴：复制应靠近结果；输入缺失要给出明确前置条件。
- 本项目调整：不隐藏主入口。没有划词时保留弹窗结构，直接说明如何重新划选；不加入社交分享和账户体系。

### 3.3 HARPA AI

HARPA 官方欢迎页把模型连接放在顶部 `MODELS`，提供 API Section 接入用户自己的 Key；`PAGE` 由用户主动开启后才会发送当前页面内容。设置中可关闭划词浮动快捷栏。故障说明对“无法打开”和“没有视频 transcript”分别列出可能原因及处理步骤。[官方欢迎页与故障说明](https://harpa.ai/welcome)

- 信息层级：模型、页面上下文、命令和自动化形成多入口工作台。
- 空状态：缺少 Agent 时显示安装与启用指引。
- 设置与数据边界：页面上下文需要显式开启，适合借鉴其“发送前让用户知道范围”的表达。
- 错误状态：公开故障文案会说明具体原因候选和下一步，优于只显示“出错了”。
- 加载、成功和 BYOK 密钥清除：上述页面没有足够公开细节，本调研不作推断。
- 可借鉴：数据发送范围明确、错误可执行。
- 不照搬：MVP 保留三种固定任务，不做聊天、命令市场、自动化、多模型或页面监控。

### 3.4 归纳结论

1. 结果区是视觉中心，原文默认折叠但始终可核对。
2. 模式只保留三个选项；翻译方向是该模式下唯一新增控件。
3. 设置不与主任务争夺空间，通过同一 popup 内的独立设置视图进入。
4. 复制、取消、重试、清除都应有明确文字反馈。
5. 竞品的公开文档没有证明一套完整的 BYOK 清除体验，本项目需自行把“清除本地会话密钥”与“在服务商后台撤销密钥”区分清楚。

## 4. 320px 信息架构

### 4.1 主视图顺序

```text
┌──────────────────────────────┐
│ Gemini 速审助手        设置  │  16px 标题，20px 设置图标，44px 命中区
├──────────────────────────────┤
│ [摘要] [安全审查] [翻译]      │  原生 radio 组成的单选组
│ 翻译方向：自动 / 中译英…      │  仅翻译模式显示
│                              │
│ 已选内容 · 128 字        展开 │  默认显示 2 行预览
│ 选中文本预览……               │
│                              │
│ [生成摘要]                    │  唯一主按钮，文案随模式变化
│ 点击后仅发送当前选中文本       │  12px 隐私提示
│                              │
│ 结果 / 空状态 / 加载 / 错误   │  主任务反馈区
└──────────────────────────────┘
```

布局约束：

- body 总宽固定 320px，包含 padding；内容宽 288px，页面 padding 16px。
- 区块间距 16px，组内间距 8px 或 12px，所有间距来自 4px 网格。
- 常规内容不需要卡片嵌套。原文与结果各保留一个 1px 边界即可。
- 弹窗最大内容高度建议 560px，超出时 popup 内部纵向滚动；不出现横向滚动。
- Chrome 官方规定 action popup 会自动适应内容，尺寸需在 25×25 到 800×600px 之间。[Action API](https://developer.chrome.com/docs/extensions/reference/action/)
- 长结果不增加侧栏、历史记录或多栏布局。MVP 不做深色主题切换和响应式框架。

### 4.2 设置视图

```text
┌──────────────────────────────┐
│ 返回  设置                    │
├──────────────────────────────┤
│ Gemini API Key               │
│ [密码输入框] [显示/隐藏]       │
│ 仅保存到本次浏览器会话         │
│ 浏览器退出或扩展刷新后需重填   │
│ [保存到本次会话]              │
│ 官方 API Key 获取说明          │
│                              │
│ 密钥管理                      │
│ 当前状态：已保存 / 未配置      │
│ [清除密钥]                    │
│ 清除只影响本扩展，不会撤销     │
│ 服务商后台的密钥               │
│                              │
│ [使用固定样例离线演示]         │
└──────────────────────────────┘
```

官方 Key 获取说明的 URL 必须在实现前核验。保存成功只表示“已保存到本次会话”，不表示 Key 已通过 API 验证。

## 5. 主流程与状态规范

### 5.1 主流程

1. 用户划选文本并通过右键进入扩展。
2. 弹窗显示原文预览、字符数和默认“摘要”模式。
3. 用户选择模式；翻译模式可选自动、中译英、英译中。
4. 用户点击“生成摘要”“开始安全审查”或“开始翻译”。
5. 本地检查非空、不超过 10,000 字符、已配置会话 Key。检查失败时不发请求。
6. 请求期间只保留一个当前任务，禁止重复提交，可取消。
7. 成功时显示当前模式、来源类型、时间和复制入口；失败时显示分类原因与下一步。
8. 修改原文、模式或翻译方向后，旧结果标为“结果已失效”，不得冒充当前输入的结果。

### 5.2 状态矩阵与建议文案

| 状态 | 界面表现 | 建议文案与操作 |
|---|---|---|
| 无划词 Empty | 保留标题和设置；结果区显示操作指引；提交禁用 | 标题“还没有选中文本”；说明“请在网页中划选文字，再通过右键菜单打开本扩展。” |
| 未配置 Key | 主按钮附近显示内联配置提示，不弹假成功 | “需要先配置 API Key。”操作“去设置”；若用户点击分析，同样只进入该提示，不发送请求 |
| 可提交 Ready | 显示字符数、模式、隐私提示 | “点击后仅将当前选中文本发送至 Gemini API。含密码或验证码时，请取消并重新划选。” |
| 加载 Loading | 结果区 `aria-busy="true"`，2 至 3 条静态骨架；状态文字；主按钮变为取消 | “正在生成摘要…”或对应模式；不用无限旋转之外的无文字加载，不逐字播报流式内容 |
| 成功 Success | 结果标题、模式、来源、时间、复制；来源全程可见 | “Gemini API · 14:32”或“离线演示，非 Gemini API 结果”；复制后“已复制” |
| 内容不足 | 作为可理解的无结论结果，不补造内容 | “选中文本信息不足，无法形成可靠摘要。” |
| 输入边界 Edge | 本地错误靠近提交按钮，保留原文 | “已选 10,024 字，超过 10,000 字上限。请缩短选区后重试。” |
| 请求错误 Error | 结果区显示原因、下一步和适用操作；原文仍可查看 | 见下表；不展示完整 Key、请求头或未经脱敏的响应 |
| 旧结果 Stale | 结果顶部显示失效条，复制禁用 | “输入或模式已更改，请重新分析。” |
| 弹窗重开 | 恢复当前会话配置和最后任务；无法可靠恢复时明确说明 | “上次任务状态无法恢复，请重新提交。” |

Chrome 官方说明，popup 在焦点移到弹窗外时会自动关闭，且无法通过普通点击继续保持打开。因此任务状态恢复是实现要求，不能假设 popup 一直存活。[Chrome popup 生命周期](https://developer.chrome.com/docs/extensions/develop/ui/add-popup)

### 5.3 错误分类

错误码到类别的最终映射以架构核验为准，UI 不直接展示原始错误作为唯一说明。

| 类别 | 用户可读说明 | 下一步 |
|---|---|---|
| 未配置 | “需要先配置 API Key。” | 去设置 |
| 认证失败 | “API Key 未通过验证。” | 检查后重新保存；仍失败时到官方后台确认 |
| 无权限、项目或地区不可用 | “当前项目无法调用此 API。” | 查看官方项目、模型与地区支持；不提供跨区建议 |
| 限流或额度 | “请求频率或项目额度暂时受限。” | 稍后重试，查看官方额度说明 |
| 离线或网络失败 | “无法连接 Gemini API，请检查网络。” | 重试；可进入离线演示 |
| 超时 | “等待超过 30 秒，本次请求已停止。” | 重试；不保留成功假象 |
| 空响应或格式异常 | “服务返回的内容无法识别。” | 重试；保留脱敏诊断类别 |
| 未知错误 | “请求未完成。” | 重试；提供“复制脱敏错误信息”，不包含原文和 Key |

### 5.4 安全审查结果结构

安全审查使用固定小节，不使用分数仪表盘：

1. 风险类型。
2. 原文依据，引用选中文本中的短片段。
3. 判断理由。
4. 不确定性。
5. 建议动作。

未发现明显信号时显示：“未发现明显文本风险信号，不代表链接、文件或发送者安全。”结果不显示“绝对安全”“可放心点击”等保证性文案。

## 6. BYOK 保存与密钥清除流程

### 6.1 保存

- MVP 仅使用会话级保存，不提供“记住我”。这与 PRD 范围一致。
- 输入框使用可见 label，默认遮蔽，提供显示/隐藏按钮；禁止把 Key 放进 placeholder、URL、日志或结果区。
- 保存后清空可编辑输入内容，界面只显示“已保存到本次会话”，不回显完整 Key。
- 不在保存时显示“密钥有效”。只有真实请求成功后，才能描述该次请求成功。
- Chrome 官方说明 `storage.session` 在扩展停用、重新加载、更新和浏览器重启时清除；敏感用户数据应优先考虑 session。[Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

### 6.2 清除

1. 用户进入“设置”，在“密钥管理”选择“清除密钥”。未配置时该按钮禁用。
2. 按钮下方展开内联确认区，不新开复杂 modal：“清除后，本次会话将无法继续调用 Gemini API。”
3. 初始焦点放在“取消”；“确认清除”使用危险语义按钮。
4. 确认后禁用两个按钮，移除当前会话 Key 和内存中的 Key，不调用会清空其他设置的 `clear()`。
5. 完成后显示“密钥已从本次会话清除”，设置状态回到“未配置”，主视图后续提交也回到未配置分支。
6. 固定说明：“这里只移除本扩展中的密钥，不会撤销服务商后台的密钥。若怀疑泄露，请到官方后台撤销。”

Chrome Storage API 区分 `remove()` 的单项移除与 `clear()` 的全区清除；UI 应只触发 Key 项移除。[方法说明](https://developer.chrome.com/docs/extensions/reference/api/storage)

## 7. 视觉 Token 提案

原始颜色只定义在 Token 层，组件禁止出现裸色值。MVP 使用浅色、克制的产品界面；无渐变、无装饰性毛玻璃、无大阴影。

```css
:root {
  color-scheme: light;

  --bg: oklch(98.5% 0.004 220);
  --surface: oklch(100% 0 0);
  --surface-subtle: oklch(96.5% 0.006 220);
  --fg: oklch(24% 0.015 230);
  --fg-2: oklch(36% 0.015 230);
  --muted: oklch(42% 0.015 230);
  --meta: oklch(46% 0.012 230);
  --border: oklch(88% 0.008 220);
  --border-soft: oklch(93% 0.005 220);

  --accent: oklch(45% 0.09 185);
  --accent-on: oklch(100% 0 0);
  --accent-hover: oklch(40% 0.085 185);
  --accent-active: oklch(36% 0.08 185);
  --accent-soft: oklch(95% 0.025 185);

  --success: oklch(43% 0.11 145);
  --success-soft: oklch(95% 0.025 145);
  --warn: oklch(42% 0.1 75);
  --warn-soft: oklch(95% 0.025 75);
  --danger: oklch(47% 0.17 25);
  --danger-soft: oklch(95% 0.025 25);
  --info: oklch(45% 0.09 235);
  --info-soft: oklch(95% 0.02 235);

  --font-display: "Segoe UI Variable", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --font-body: "Segoe UI Variable", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --font-mono: "Cascadia Code", Consolas, monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --leading-body: 1.55;
  --leading-tight: 1.3;
  --weight-read: 400;
  --weight-emphasize: 510;
  --weight-announce: 590;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;

  --elev-flat: none;
  --elev-ring: 0 0 0 1px var(--border);
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent);
  --motion-fast: 150ms;
  --motion-base: 200ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);

  --popup-width: 320px;
  --popup-max-height: 560px;
  --control-height: 44px;
}
```

实施要求：

- 不请求在线字体，避免增加弹窗加载和离线依赖；字体栈显式指定中文回退。
- 强调色每屏最多两处主要可见使用：当前模式与主按钮。状态色仅用于对应状态。
- 按钮圆角 8px，结果容器圆角 8px；不使用彩色左边框，不使用超过 12px 的卡片圆角。
- 所有颜色组合在实现后实测对比度；正文至少 4.5:1，控件边界和焦点指示至少 3:1。[WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 8. 图标方案

建议锁定 **Lucide** 一套 SVG 图标，与架构师后续确认后写入技术 Spec。官方提供 Vanilla Web 包、统一设计规则和按需打包能力，适合原生 HTML/CSS/JS，不需要 React。[Lucide 官方说明](https://lucide.dev/guide/)

- 交付方式：优先将实际使用的 SVG 子集随扩展本地打包，不运行时请求 CDN。
- 尺寸：行内状态 16px，按钮内 20px，独立说明图标 24px。
- 描边：统一 2px，颜色继承 `currentColor`，不混用其他图标库。
- 建议子集：`Settings`、`ArrowLeft`、`Copy`、`Check`、`Eye`、`EyeOff`、`Trash2`、`FileText`、`ShieldAlert`、`Languages`、`CircleAlert`、`LoaderCircle`、`X`。
- 设置、复制、清除等纯图标按钮必须有可访问名称；装饰性 SVG 使用 `aria-hidden="true"`。
- 不使用 emoji 代替图标。离线演示、成功、警告也使用文字与同一套 SVG。

## 9. 响应式、键盘与无障碍验收

### 9.1 小窗口与缩放

- 320px 是唯一目标宽度，不把桌面网页断点体系照搬到 popup。
- 200% 文本缩放时不隐藏核心操作；允许纵向滚动和文字换行，不允许横向滚动。
- 长 URL、代码、连续字符使用 `overflow-wrap:anywhere`；flex 子项设置 `min-width:0`。
- 触摸和鼠标目标统一至少 44×44px，目标间距至少 8px。该值高于 WCAG 2.2 的 24px 最低要求，作为本项目易用性约束。[WCAG 2.2 Target Size](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- 不依赖 hover 才显示核心功能，不禁止浏览器缩放。

### 9.2 键盘与焦点

- 主视图顺序：标题后设置按钮、模式单选组、翻译方向、原文 disclosure、主按钮、结果操作。
- 模式优先使用原生 `input type="radio"` 和 `fieldset/legend`，减少自制 tabs 的键盘复杂度。
- 所有交互元素使用 `:focus-visible`，不得移除 outline；焦点样式引用 `--focus-ring`。
- 设置视图打开后焦点移到设置标题；返回后焦点回到设置按钮。清除确认出现时焦点移到“取消”。
- 键盘可完成模式选择、提交、取消、复制、设置、显示/隐藏 Key、保存和清除。
- WCAG 2.2 要求键盘可操作界面具有可见焦点。[Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

### 9.3 状态播报

- 普通加载、复制成功、保存成功使用一个持续存在的 `role="status"`、`aria-live="polite"`、`aria-atomic="true"` 区域。
- 阻止提交的字段错误与字段关联；请求失败可用 `role="alert"`，但不要同时让多个 live region 重复播报。
- 结果正文不放进高打断性的 alert；流式字符增长不逐字播报，完成后播报一次“摘要已生成”。
- 加载时设置结果区 `aria-busy="true"`，结束后恢复。
- WCAG 2.2 SC 4.1.3 要求状态消息可被辅助技术识别，且无需移动焦点。[Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

### 9.4 动效与组件状态

- 只使用 150ms 颜色、边框和透明度过渡；布局变化不超过 200ms。
- 支持 `prefers-reduced-motion: reduce`：关闭骨架位移、旋转和非必要过渡，保留文字状态。
- 按钮覆盖 Default、Hover、Focus、Active、Disabled、Loading；输入框另覆盖 Error；任务区覆盖 Empty、Error、Populated、Edge 和 Success。
- Loading 时防重复提交；Disabled 不能只用透明度表达，也保留可理解的禁用原因。
- 复制成功采用结果旁文字反馈，不使用遮挡内容的 toast。

## 10. 面向实现的最小约束

1. 继续使用原生 HTML、CSS、JavaScript；主视图和设置视图可用两个 `section` 切换，不引入前端框架。
2. 颜色、字号、间距、圆角、焦点和动效只消费 Token；组件样式不写裸颜色。
3. 模式、任务状态、结果来源和错误类别使用明确状态机，避免多个布尔值拼出互相矛盾的 UI。
4. 每次任务绑定来源标签、原文、模式、翻译方向和请求 ID。旧响应不得覆盖新任务。
5. 选中文本和模型输出按文本安全渲染，不直接注入不可信 `innerHTML`。
6. 弹窗重开后的任务恢复由架构确定存储与消息机制；UI 必须能表现“恢复中”“可继续查看”“需重新提交”。
7. MVP 不加入深色主题、历史记录、快捷键设置、自定义提示词、多模型、多语言和持久保存 Key。
8. 实机验收至少覆盖：无划词、未配置、保存、清除、三种模式成功、取消、超时、离线、认证失败、无权限、限流、异常响应、10,000 字边界、弹窗关闭重开、键盘全流程、200% 缩放和 reduced-motion。

## 11. 外部来源

- DeepL 划词翻译：https://support.deepl.com/hc/en-us/articles/4407580229522-Translate-with-the-browser-extensions
- DeepL 设置：https://support.deepl.com/hc/en-us/articles/4407573357330-Accessing-the-settings-of-the-browser-extensions
- Glasp AI 摘要教程：https://glasp.co/posts/d071dffb-b9bd-43f4-87da-39749cbc2c99
- HARPA AI 欢迎页与故障说明：https://harpa.ai/welcome
- Chrome Action API：https://developer.chrome.com/docs/extensions/reference/action/
- Chrome popup：https://developer.chrome.com/docs/extensions/develop/ui/add-popup
- Chrome Storage API：https://developer.chrome.com/docs/extensions/reference/api/storage
- Lucide 官方指南：https://lucide.dev/guide/
- WCAG 2.2：https://www.w3.org/TR/WCAG22/
- WCAG 2.2 Focus Visible：https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 Status Messages：https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 新增强制项说明：https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
