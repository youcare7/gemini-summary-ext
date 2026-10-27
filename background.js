// Service Worker 装配入口：只注册菜单、快捷键与消息路由，不含业务逻辑。
import { createController } from './src/background/controller.js';
import { registerMenu } from './src/background/menu.js';
import { attachMessageRouter } from './src/background/message-router.js';

const controller = createController();

registerMenu({
  onSelection: (selectionText) => controller.onMenuSelection(selectionText),
  onInstalled: () => controller.onInstalled(),
  onPopupResult: (opened) => controller.setOpenPopupHint(!opened),
});

attachMessageRouter(controller);

// 快捷键 Ctrl+Shift+S：捕获当前选中文本并打开弹窗。
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'analyze-selection') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString(),
      });
      if (result) await controller.onMenuSelection(result);
    }
  } catch {
    // 无法获取选中文本（如 chrome:// 页面），仍打开弹窗让用户手动操作
  }
  try {
    await chrome.action.openPopup();
  } catch {
    // 环境限制时由用户手动点击扩展图标
  }
});
