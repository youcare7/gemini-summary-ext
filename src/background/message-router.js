// 内部消息路由（Spec §5）：chrome.runtime.onMessage -> controller。
// ANALYZE_REQUEST 为异步任务：立即受理，完成后由 controller 广播 ANALYZE_RESPONSE；
// 其余消息同步应答。路由层不打印任何载荷。

import {
  ANALYZE_REQUEST,
  ANALYZE_CANCEL,
  SAVE_KEY,
  CLEAR_KEY,
  GET_STATE,
} from '../contracts/messages.js';

/**
 * 挂载消息路由（须在 Service Worker 顶层同步调用）。
 * @param {ReturnType<import('./controller.js').createController>} controller
 */
export function attachMessageRouter(controller) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = message && message.type;

    if (type === ANALYZE_REQUEST) {
      // 受理后立即返回；结果经 ANALYZE_RESPONSE 广播（弹窗关闭后由任务快照恢复）
      controller.startAnalysis({
        requestId: message.requestId,
        mode: message.mode,
        text: message.text,
        targetLanguage: message.targetLanguage,
      });
      return false;
    }

    if (type === ANALYZE_CANCEL) {
      controller.cancelAnalysis(message.requestId).then(sendResponse);
      return true;
    }

    if (type === SAVE_KEY) {
      controller.saveKey(message.key).then(sendResponse);
      return true;
    }

    if (type === CLEAR_KEY) {
      controller.clearKey().then(sendResponse);
      return true;
    }

    if (type === GET_STATE) {
      controller.getState().then(sendResponse);
      return true;
    }

    return false;
  });
}
