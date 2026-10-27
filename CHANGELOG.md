# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/) 格式。

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
