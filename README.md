# Gemini Quick-Audit

> 基于 Google Gemini API 的浏览器划词速审助手 —— 选中网页任意文本，一键获取 AI 摘要与安全分析。

## 开发背景

我是一名大二软件工程（网络安全方向）学生，日常读技术文档、论文和英文资料时经常需要快速总结长文本。
市面上的划词翻译/总结工具大多闭源且收费，于是我基于 Google Gemini API 与 Chrome Extension Manifest V3 规范，从零写了这个浏览器插件。

当前版本处于 MVP 阶段：浏览器端交互（划词捕获、右键菜单、弹窗展示）已完整跑通，Gemini API 输出端正在接入中。

## 技术栈

- **Chrome Extension Manifest V3**（最新扩展规范）
- **Google Generative Language API**（Gemini）
- 原生 HTML / CSS / JavaScript，无任何框架依赖
- `chrome.contextMenus` + `chrome.storage.local` 实现划词捕获

## 功能

- [x] 划选网页文本，右键弹出「✨ 使用 Gemini 速审这段内容」
- [x] 点击后自动弹出插件窗口，展示选中内容
- [x] 前端 UI：卡片式摘要展示
- [ ] Gemini API 真实总结输出
- [ ] 支持自定义提示词（安全审查 / 论文摘要 / 翻译模式）
- [ ] BYOK 机制：用户自行填入 API Key，杜绝 Key 硬编码

## 安装

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目文件夹
4. 在任意网页选中一段文字，右键即可看到菜单项

## 项目结构

```
gemini-summary-ext/
├── manifest.json    # 扩展配置（Manifest V3）
├── background.js     # Service Worker：右键菜单注册与事件监听
├── popup.html        # 弹窗界面
└── popup.js          # 弹窗逻辑：读取划词并展示
```

## License

MIT
