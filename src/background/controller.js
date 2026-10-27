// 任务编排（应用层）：requestId 绑定、AbortController 单活动请求、任务快照与结果广播。
// 不打印正文、Key、请求头与完整响应；生产零持久日志。

import { createErrorResponse, createSuccessResponse } from '../contracts/messages.js';
import { buildError } from '../services/error-mapping.js';
import { DEFAULT_MODEL } from '../config/defaults.js';
import { analyze } from '../services/analysis-service.js';
import * as keyStore from '../infrastructure/key-store.js';
import * as taskStore from '../infrastructure/task-store.js';

export function createController() {
  /** @type {Map<string, AbortController>} requestId -> 控制器 */
  const active = new Map();
  /** 当前任务 requestId（旧响应不覆盖新任务） */
  let currentRequestId = null;

  async function broadcast(message) {
    try {
      await chrome.runtime.sendMessage(message);
    } catch {
      /* 弹窗未打开时无接收方，忽略 */
    }
  }

  async function finish(requestId, response, taskPatch) {
    if (requestId === currentRequestId) {
      const prev = (await taskStore.getCurrentTask()) || {};
      await taskStore.setCurrentTask({ ...prev, ...taskPatch, requestId });
    }
    await broadcast(response);
  }

  function abortAll() {
    for (const [id, ctl] of [...active.entries()]) {
      ctl.abort();
      active.delete(id);
    }
  }

  /** 右键菜单捕获：写入 session.pendingAnalysis（openPopup 由 menu.js 在同步上下文中调用）。 */
  async function onMenuSelection(selectionText) {
    await keyStore.migrateLegacyData();
    await taskStore.setPendingAnalysis(typeof selectionText === 'string' ? selectionText : '');
  }

  /** 安装/更新时清理旧版持久正文。 */
  async function onInstalled() {
    await keyStore.migrateLegacyData();
  }

  /**
   * 发起分析：同一时刻仅一个活动请求；新请求取消旧请求。
   * 完成后广播 ANALYZE_RESPONSE，并写入 session 任务快照。
   */
  async function startAnalysis({ requestId, mode, text, targetLanguage }) {
    abortAll();
    const controller = new AbortController();
    active.set(requestId, controller);
    currentRequestId = requestId;

    await taskStore.setCurrentTask({
      requestId,
      mode,
      targetLanguage: targetLanguage || null,
      text: typeof text === 'string' ? text : '',
      status: 'loading',
      result: null,
      meta: null,
      error: null,
      startedAt: Date.now(),
    });

    const apiKey = await keyStore.getKey();
    const outcome = await analyze({
      text,
      mode,
      targetLanguage,
      apiKey,
      model: DEFAULT_MODEL,
      signal: controller.signal,
    });
    active.delete(requestId);

    if (outcome.ok) {
      const meta = { model: DEFAULT_MODEL, demo: false, source: 'api', generatedAt: Date.now() };
      await finish(requestId, createSuccessResponse({ requestId, result: outcome.result, meta }), {
        status: 'success',
        result: outcome.result,
        meta,
        error: null,
      });
    } else {
      await finish(requestId, createErrorResponse({ requestId, error: outcome.error }), {
        status: 'error',
        result: null,
        meta: null,
        error: outcome.error,
      });
    }
  }

  /** 取消当前活动请求。 */
  async function cancelAnalysis(requestId) {
    for (const [id, ctl] of [...active.entries()]) {
      if (!requestId || id === requestId) {
        ctl.abort();
        active.delete(id);
      }
    }
    return { ok: true };
  }

  /** 保存 Key 到会话；不回显。 */
  async function saveKey(key) {
    const value = typeof key === 'string' ? key.trim() : '';
    if (value === '') {
      return { ok: false, error: buildError('INVALID_REQUEST', { message: 'Key 不能为空。下一步：粘贴 API Key 后保存。' }) };
    }
    await keyStore.saveKey(value);
    return { ok: true };
  }

  /** 清除会话 Key，并取消进行中的请求。 */
  async function clearKey() {
    abortAll();
    await keyStore.clearKey();
    return { ok: true };
  }

  /** 弹窗状态恢复：loading 但无活动请求时判为无法恢复。 */
  async function getState() {
    const pendingAnalysis = await taskStore.getPendingAnalysis();
    let currentTask = await taskStore.getCurrentTask();
    if (currentTask && currentTask.status === 'loading' && !active.has(currentTask.requestId)) {
      const error = buildError('CANCELLED', { message: '上次任务状态无法恢复，请重新提交。' });
      currentTask = { ...currentTask, status: 'error', result: null, meta: null, error };
      await taskStore.setCurrentTask(currentTask);
    }
    return {
      pendingAnalysis,
      currentTask,
      hasKey: await keyStore.hasKey(),
      openPopupHint: await taskStore.takeOpenPopupHint(),
    };
  }

  return {
    onMenuSelection,
    onInstalled,
    startAnalysis,
    cancelAnalysis,
    saveKey,
    clearKey,
    getState,
    setOpenPopupHint: taskStore.setOpenPopupHint,
  };
}
