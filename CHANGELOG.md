# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/) 格式。

## [未发布]

### 新增
- 安全硬约束：非 info 级 finding 必须有非空原文 evidence；security 输出必须含固定免责声明，违反即判整个结果失败
- 真实 API 评估集：7 个固定用例、最小冒烟与可选 10,000 字符边界；默认跳过，脱敏记录见 `docs/LIVE-EVALUATION.md`
- E2E 接入 axe-core，覆盖空态、设置页和安全结果页的 WCAG 自动扫描
- GitHub Actions：离线测试、截图重生成、ZIP 打包、SHA-256 与构建 artifact
- AC-17 安全硬约束验收标准；新增 2 项单测与 1 项 E2E

### 变更
- 强调色切换为 Google 蓝（`oklch(54% 0.2 264)`），工具栏图标与 README 截图同步更新
- 容器卡片使用 10px 圆角，icon 按钮 hover 改为 8% 前景状态层
- 新增工具栏应用图标：16/32/48/128 PNG，`manifest.json` 补 `icons` 与 `action.default_icon`、`default_title`。此前工具栏显示灰色拼图占位
- 视觉层级重排：标题下边距 16→20px，主视图区块间距 16→12px，设置视图 24px，三处卡片内边距统一 16px
- 新增 `--border-control`，交互控件边界对比度由 1.43:1 提升到 3.11:1，满足 WCAG 2.2 对控件边界 3:1 的要求
- 主按钮禁用态改为虚线占位，与就绪态形成明确形态差，不再只靠颜色区分
- 结果正文行高提到 1.7，启用 `text-wrap: pretty` 与 `line-break: strict`，加顶部细线分区
- 骨架屏动画改为 1.6s 透明度往复（1 → 0.72），原 1.2s / 0.55 幅度过闪
- 清理 8 个未被任何样式引用的死 Token：`--text-lg`、`--weight-read`、`--space-8`、`--radius-lg`、`--radius-pill`、`--elev-flat`、`--elev-ring`、`--motion-base`

### 修复
- 禁用按钮 hover 时闪强调色：`.btn-primary:hover`（特异性 0,2,0）盖过 `button:disabled`（0,1,1）
- 原文预览 `max-height: 44px` 不是行高整数倍（12px × 1.55 = 18.6px），折叠态第三行被拦腰截断出现半行残缺字形
- 模式单选改用标准 `.sr-only`（`clip` → `clip-path: inset(50%)`），删除 `.mode-option input` 的重复隐藏规则
- `.privacy-hint` 与 `.hint` 规则完全重复，合并为 `.hint`
- 复制反馈去掉 `role="status"` 已隐含的 `aria-live`，空态不再占位

## [0.9.0-preview] - 2026-10-27

### 新增
- Chrome MV3 扩展骨架：右键菜单、快捷键、图标弹窗三种触发方式
- 三模式：摘要 / 安全审查 / 中英翻译
- BYOK：API Key 仅存 `chrome.storage.session`，关浏览器即清除
- 离线演示模式：无 Key 可体验完整 UI，全程标注"非 Gemini API 结果"
- 安全渲染：模型输出一律 `textContent`，防 XSS
- 错误分类：401/403/404/429/超时/网络/格式错误，各有用户可见提示与下一步
- 输入上限：10,000 字符，本地拦截不发请求
- 86 项自动化测试（71 单测 + 15 E2E）

### 已知限制
- ❌ 真实 Gemini API 调用未验收（Google Cloud 项目报 403 免费层不可用）
- ❌ 默认模型 `gemini-3.8-flash` 未经真实推理确认
- ❌ 仅 Chrome ≥ 127，仅中文界面
