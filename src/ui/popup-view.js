// 弹窗视图（表现层）：状态机驱动交互，安全 DOM 由 popup-render 完成。
// 状态：empty | ready | loading | success | error | stale | edge（+ 设置视图）。
// 不直接调用 Gemini；网络经 chrome.runtime 消息由 Service Worker 完成。

import {
  ANALYZE_RESPONSE,
  ANALYZE_CANCEL,
  GET_STATE,
  createAnalyzeRequest,
} from '../contracts/messages.js';
import { checkInput } from '../services/analysis-service.js';
import { buildValidationError } from '../services/error-mapping.js';
import { validateResult } from '../services/result-validator.js';
import { loadPrefs, savePrefs } from '../infrastructure/task-store.js';
import { DEMO_RESULTS } from '../config/demo-samples.js';
import {
  collectElements,
  renderView,
  resultToText,
} from './popup-render.js';
import { bindSettings } from './settings-controller.js';
import { writeClipboardText } from './clipboard.js';

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
    demoResult: null,
    activeEvidence: null,
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
    state.activeEvidence = null;
  }

  function submitDemo() {
    const candidate = state.demoResult || DEMO_RESULTS[state.mode];
    const validation = validateResult(candidate, { mode: state.mode, sourceText: state.text.trim() });
    state.currentRequestId = null;
    state.meta = {
      model: 'offline-demo',
      demo: true,
      source: 'demo',
      generatedAt: Date.now(),
    };
    state.copyFeedback = '';
    if (!validation.ok) {
      state.taskState = 'error';
      state.result = null;
      state.error = buildValidationError(validation.reason, { demo: true });
      state.statusText = '离线演示：校验失败，未展示模型结果。';
    } else {
      state.taskState = 'success';
      state.result = validation.result;
      state.error = null;
      state.statusText = '离线演示结果已生成，未发送网络请求。';
    }
    render();
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
      submitDemo();
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
    state.activeEvidence = null;
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
    state.copyFeedback = await writeClipboardText(text);
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
    bindSettings({ els, state, actions: { render, openSettings, closeSettings } });
    els.btnPrimary.addEventListener('click', submit);
    els.btnCopy.addEventListener('click', copyResult);
    els.btnExpand.addEventListener('click', () => {
      state.expanded = !state.expanded;
      render();
    });
    els.resultFindings.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-evidence-index]');
      if (!button || !state.result) return;
      const finding = state.result.findings[Number(button.dataset.evidenceIndex)];
      if (!finding || !finding.evidence) return;
      state.activeEvidence = finding.evidence;
      render();
      const mark = els.sourceText.querySelector('mark[data-evidence-active="true"]');
      if (mark) {
        mark.scrollIntoView({ block: 'nearest' });
        mark.focus({ preventScroll: true });
      }
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
