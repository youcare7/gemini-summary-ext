// 弹窗视图（表现层）：状态机驱动交互，安全 DOM 由 popup-render 完成。
// 状态：empty | ready | loading | success | error | stale | edge（+ 设置视图）。
// 不直接调用 Gemini；网络经 chrome.runtime 消息由 Service Worker 完成。

import {
  ANALYZE_RESPONSE,
  ANALYZE_CANCEL,
  SAVE_KEY,
  CLEAR_KEY,
  GET_STATE,
  createAnalyzeRequest,
} from '../contracts/messages.js';
import { checkInput } from '../services/analysis-service.js';
import { loadPrefs, savePrefs } from '../infrastructure/task-store.js';
import { DEMO_TEXT, DEMO_RESULTS } from '../config/demo-samples.js';
import {
  collectElements,
  renderView,
  resultToText,
} from './popup-render.js';

export function initPopupView() {
  const els = collectElements();
  const state = {
    view: 'main',
    taskState: 'empty',
    text: '',
    mode: 'summary',
    targetLanguage: 'auto',
    hasKey: false,
    demo: false,
    expanded: false,
    currentRequestId: null,
    result: null,
    meta: null,
    error: null,
    statusText: '',
    copyFeedback: '',
    keyVisible: false,
    clearConfirmOpen: false,
    savingKey: false,
    clearingKey: false,
  };

  function render() {
    renderView(els, state);
  }

  function markStaleIfResult() {
    if (state.taskState === 'success') state.taskState = 'stale';
    state.copyFeedback = '';
    state.statusText = '';
  }

  function submit() {
    if (state.taskState === 'loading') {
      chrome.runtime
        .sendMessage({ type: ANALYZE_CANCEL, requestId: state.currentRequestId })
        .catch(() => {});
      state.statusText = '正在取消…';
      render();
      return;
    }
    const check = checkInput(state.text);
    if (!check.ok) {
      state.taskState = 'edge';
      state.error = check.error;
      state.statusText = check.error.message;
      render();
      return;
    }
    if (state.demo) {
      state.taskState = 'success';
      state.result = DEMO_RESULTS[state.mode];
      state.meta = { model: 'demo', demo: true, source: 'demo', generatedAt: Date.now() };
      state.error = null;
      state.copyFeedback = '';
      state.statusText = '离线演示结果已生成，未发送网络请求。';
      render();
      return;
    }
    if (!state.hasKey) {
      state.taskState = 'error';
      state.error = {
        kind: 'MISSING_KEY',
        status: 0,
        retryable: false,
        message: '需要先配置 API Key。下一步：打开设置并保存到本次会话。',
      };
      state.statusText = '需要先配置 API Key。';
      render();
      return;
    }
    state.currentRequestId = crypto.randomUUID();
    state.taskState = 'loading';
    state.error = null;
    state.copyFeedback = '';
    state.statusText = '已提交，仅发送当前选中文本。';
    render();
    chrome.runtime
      .sendMessage(
        createAnalyzeRequest({
          requestId: state.currentRequestId,
          mode: state.mode,
          text: state.text,
          targetLanguage: state.targetLanguage,
        }),
      )
      .catch(() => {});
    savePrefs({ mode: state.mode, targetLanguage: state.targetLanguage }).catch(() => {});
  }

  function onAnalyzeResponse(message) {
    if (!message || message.requestId !== state.currentRequestId) return; // 旧响应不覆盖新任务
    if (message.ok) {
      state.taskState = 'success';
      state.result = message.result;
      state.meta = message.meta || { model: '', demo: false, generatedAt: Date.now() };
      state.error = null;
      state.statusText = message.result && message.result.mode === 'summary' ? '摘要已生成。' : '已完成。';
    } else {
      state.taskState = 'error';
      state.result = null;
      state.meta = null;
      state.error = message.error;
      state.statusText = '请求失败。';
    }
    render();
  }

  async function copyResult() {
    if (state.taskState !== 'success' || !state.result) return;
    const text = resultToText({ result: state.result, meta: state.meta });
    try {
      await navigator.clipboard.writeText(text);
      state.copyFeedback = '已复制';
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      try {
        document.execCommand('copy');
        state.copyFeedback = '已复制';
      } catch {
        state.copyFeedback = '复制失败，请手动选择文本复制。';
      }
      ta.remove();
    }
    render();
  }

  function openSettings() {
    state.view = 'settings';
    render();
    els.viewTitle.focus();
  }

  function closeSettings() {
    state.view = 'main';
    render();
    els.btnSettings.focus();
  }

  function bind() {
    els.btnSettings.addEventListener('click', openSettings);
    els.btnBack.addEventListener('click', closeSettings);
    els.btnPrimary.addEventListener('click', submit);
    els.btnCopy.addEventListener('click', copyResult);
    els.btnExpand.addEventListener('click', () => {
      state.expanded = !state.expanded;
      render();
    });

    for (const radio of document.querySelectorAll('input[name="mode"]')) {
      radio.addEventListener('change', () => {
        state.mode = radio.value;
        markStaleIfResult();
        render();
        savePrefs({ mode: state.mode }).catch(() => {});
      });
    }

    els.targetLanguage.addEventListener('change', () => {
      state.targetLanguage = els.targetLanguage.value;
      markStaleIfResult();
      render();
      savePrefs({ targetLanguage: state.targetLanguage }).catch(() => {});
    });

    els.btnErrorAction.addEventListener('click', () => {
      if (state.error && state.error.kind === 'MISSING_KEY') {
        openSettings();
        return;
      }
      submit();
    });

    els.btnToggleKey.addEventListener('click', () => {
      state.keyVisible = !state.keyVisible;
      render();
    });

    els.btnSaveKey.addEventListener('click', async () => {
      const value = els.keyInput.value;
      if (value.trim() === '') {
        els.keyStatus.textContent = 'Key 不能为空。下一步：粘贴 API Key 后保存。';
        return;
      }
      state.savingKey = true;
      render();
      const res = await chrome.runtime.sendMessage({ type: SAVE_KEY, key: value }).catch(() => null);
      state.savingKey = false;
      if (res && res.ok) {
        els.keyInput.value = ''; // 保存后清空输入，不回显完整 Key
        state.hasKey = true;
        els.keyStatus.textContent = '已保存到本次会话。保存不代表 Key 已通过 API 验证。';
      } else {
        els.keyStatus.textContent = (res && res.error && res.error.message) || '保存失败，请重试。';
      }
      render();
    });

    els.keyInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        els.btnSaveKey.click();
      }
    });

    els.btnClearKey.addEventListener('click', () => {
      state.clearConfirmOpen = true;
      render();
      els.btnClearCancel.focus();
    });

    els.btnClearCancel.addEventListener('click', () => {
      state.clearConfirmOpen = false;
      render();
    });

    els.btnClearConfirm.addEventListener('click', async () => {
      state.clearingKey = true;
      render();
      const res = await chrome.runtime.sendMessage({ type: CLEAR_KEY }).catch(() => null);
      state.clearingKey = false;
      state.clearConfirmOpen = false;
      if (res && res.ok) {
        state.hasKey = false;
        els.clearStatus.textContent = '密钥已从本次会话清除。';
      } else {
        els.clearStatus.textContent = '清除失败，请重试。';
      }
      render();
    });

    els.btnDemo.addEventListener('click', () => {
      state.demo = true;
      state.text = DEMO_TEXT;
      state.result = null;
      state.meta = null;
      state.error = null;
      state.copyFeedback = '';
      state.taskState = 'ready';
      state.statusText = '已加载离线演示样例。点击主按钮查看演示结果（不会发送网络请求）。';
      closeSettings();
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === ANALYZE_RESPONSE) onAnalyzeResponse(message);
    });
  }

  async function restore() {
    const prefs = await loadPrefs().catch(() => ({}));
    if (prefs.mode) state.mode = prefs.mode;
    if (prefs.targetLanguage) state.targetLanguage = prefs.targetLanguage;

    const snapshot = await chrome.runtime.sendMessage({ type: GET_STATE }).catch(() => null);
    if (snapshot) {
      state.hasKey = Boolean(snapshot.hasKey);
      const task = snapshot.currentTask;
      const pending = snapshot.pendingAnalysis;
      if (task) {
        state.mode = task.mode || state.mode;
        state.targetLanguage = task.targetLanguage || state.targetLanguage;
        state.text = (pending && pending.text) || task.text || '';
        state.currentRequestId = task.requestId;
        if (task.status === 'loading') {
          state.taskState = 'loading';
          state.statusText = '正在恢复上次任务…';
        } else if (task.status === 'success' && task.result) {
          const stale = Boolean(pending && pending.text && pending.text !== task.text);
          state.taskState = stale ? 'stale' : 'success';
          state.result = task.result;
          state.meta = task.meta;
          state.statusText = stale ? '' : '已恢复上次结果。';
        } else if (task.status === 'error' && task.error) {
          state.taskState = 'error';
          state.error = task.error;
          state.statusText = '';
        }
      } else if (pending) {
        state.text = pending.text;
        state.taskState = 'ready';
      }
      if (snapshot.openPopupHint) {
        state.statusText = '未能自动打开弹窗，请点击扩展图标打开本扩展。';
      }
    }

    // 无待分析文本时，尝试从活动标签页自动捕获选中文本（点图标打开弹窗的场景）。
    if (!state.text && state.taskState === 'empty') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString(),
          });
          if (result && result.trim()) {
            state.text = result;
            state.taskState = 'ready';
          }
        }
      } catch {
        // 无法访问当前标签页（如 chrome:// 页面），保持空态
      }
    }

    render();
  }

  bind();
  restore();
}
