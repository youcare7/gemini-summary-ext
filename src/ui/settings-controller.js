// 设置视图控制器：Key 保存/清除、演示样例与视图切换。
// 仅绑定 DOM 事件与内部状态；真实分析流程仍由 popup-view 编排。

import { SAVE_KEY, CLEAR_KEY } from '../contracts/messages.js';
import {
  DEMO_TEXT,
  DEMO_INJECTION_TEXT,
  DEMO_INJECTION_RESULT,
  DEMO_REJECT_RESULT,
} from '../config/demo-samples.js';

/**
 * 绑定设置页交互。
 * @param {object} params
 * @param {object} params.els 由 collectElements() 收集的 DOM
 * @param {object} params.state 共享弹窗状态
 * @param {object} params.actions 主控制器动作
 * @param {() => void} params.actions.render
 * @param {() => void} params.actions.openSettings
 * @param {() => void} params.actions.closeSettings
 */
export function bindSettings({ els, state, actions }) {
  const { render, openSettings, closeSettings } = actions;

  function loadDemo({ text = DEMO_TEXT, result = null, statusText }) {
    state.demo = true;
    state.demoResult = result;
    state.mode = 'security';
    state.text = text;
    state.result = null;
    state.meta = null;
    state.error = null;
    state.activeEvidence = null;
    state.copyFeedback = '';
    state.taskState = 'ready';
    state.statusText = statusText;
    closeSettings();
  }

  els.btnSettings.addEventListener('click', openSettings);
  els.btnBack.addEventListener('click', closeSettings);

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
    loadDemo({ statusText: '已加载风险识别样例。点击主按钮查看通过校验的离线结果。' });
  });
  els.btnDemoInjection.addEventListener('click', () => {
    loadDemo({
      text: DEMO_INJECTION_TEXT,
      result: DEMO_INJECTION_RESULT,
      statusText: '已加载提示注入样例。点击主按钮查看文本指令如何被当作数据处理。',
    });
  });
  els.btnDemoReject.addEventListener('click', () => {
    loadDemo({
      result: DEMO_REJECT_RESULT,
      statusText: '已加载伪造依据样例。点击主按钮查看扩展拒绝展示未通过核验的结果。',
    });
  });
}
