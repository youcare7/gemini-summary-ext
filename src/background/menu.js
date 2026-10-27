// 右键菜单：捕获选中文本（写入 session，而非 local），并尝试打开弹窗。
// 不打印选中文本；菜单标题不使用 emoji。

const MENU_ID = 'gemini-quick-review';
const MENU_TITLE = '使用 Gemini 速审这段内容';

/**
 * 注册右键菜单与点击处理（须在 Service Worker 顶层同步调用）。
 * @param {object} handlers
 * @param {(selectionText: string) => void} handlers.onSelection
 * @param {() => void} [handlers.onInstalled] 安装/更新时的清理钩子
 * @param {(opened: boolean) => void} [handlers.onPopupResult] openPopup 成功/失败回调（用于设置提示）
 */
export function registerMenu({ onSelection, onInstalled, onPopupResult }) {
  chrome.runtime.onInstalled.addListener(() => {
    onInstalled?.();
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: MENU_TITLE,
        contexts: ['selection'],
      });
    });
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== MENU_ID) return;
    // openPopup() 必须在用户手势的同步上下文中调用，不能 await 任何异步操作后再调用。
    let opened = false;
    try {
      chrome.action.openPopup();
      opened = true;
    } catch {
      // 环境限制时由用户手动点击扩展图标打开弹窗
    }
    onPopupResult?.(opened);
    onSelection(info.selectionText);
  });
}
