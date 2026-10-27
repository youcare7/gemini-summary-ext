// 弹窗渲染层（表现层）：只负责把状态画到 DOM。
// 安全约束：一律 textContent / createElement，禁止 innerHTML 渲染任何动态内容。

const MODE_LABELS = { summary: '摘要', security: '安全审查', translate: '翻译' };
const SEVERITY_LABELS = { info: '提示', low: '低', medium: '中', high: '高' };
export const SECURITY_NOTE = '基于所选文本的辅助判断，不构成安全保证。';

export const MODE_PRIMARY_LABELS = {
  summary: '生成摘要',
  security: '开始安全审查',
  translate: '开始翻译',
};
export const MODE_LOADING_LABELS = {
  summary: '正在生成摘要…',
  security: '正在执行安全审查…',
  translate: '正在翻译…',
};

function setText(el, value) {
  if (el) el.textContent = value;
}

export function timeLabel(ts) {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** 收集弹窗 DOM 引用。 */
export function collectElements() {
  const byId = (id) => document.getElementById(id);
  return {
    btnBack: byId('btn-back'),
    btnSettings: byId('btn-settings'),
    viewTitle: byId('view-title'),
    viewMain: byId('view-main'),
    viewSettings: byId('view-settings'),
    direction: byId('translate-direction'),
    targetLanguage: byId('target-language'),
    sourceCount: byId('source-count'),
    btnExpand: byId('btn-expand'),
    sourceEmpty: byId('source-empty'),
    sourceText: byId('source-text'),
    btnPrimary: byId('btn-primary'),
    iconPlay: byId('icon-play'),
    iconStop: byId('icon-stop'),
    btnPrimaryLabel: byId('btn-primary-label'),
    status: byId('status'),
    result: byId('result'),
    resultEmpty: byId('result-empty'),
    resultEmptyText: byId('result-empty') ? byId('result-empty').querySelector('p') : null,
    resultLoading: byId('result-loading'),
    loadingText: byId('loading-text'),
    resultError: byId('result-error'),
    errorMessage: byId('error-message'),
    btnErrorAction: byId('btn-error-action'),
    resultSuccess: byId('result-success'),
    staleBar: byId('stale-bar'),
    demoBar: byId('demo-bar'),
    resultMeta: byId('result-meta'),
    resultOutput: byId('result-output'),
    resultFindings: byId('result-findings'),
    btnCopy: byId('btn-copy'),
    copyFeedback: byId('copy-feedback'),
    keyInput: byId('key-input'),
    btnToggleKey: byId('btn-toggle-key'),
    iconEye: byId('icon-eye'),
    iconEyeOff: byId('icon-eye-off'),
    keyStatus: byId('key-status'),
    btnSaveKey: byId('btn-save-key'),
    keyState: byId('key-state'),
    btnClearKey: byId('btn-clear-key'),
    clearConfirm: byId('clear-confirm'),
    btnClearCancel: byId('btn-clear-cancel'),
    btnClearConfirm: byId('btn-clear-confirm'),
    clearStatus: byId('clear-status'),
    btnDemo: byId('btn-demo'),
  };
}

function renderFindings(container, findings) {
  container.textContent = '';
  for (const f of findings) {
    const li = document.createElement('li');
    li.className = 'finding';
    const head = document.createElement('div');
    head.className = 'finding-head';
    const sev = document.createElement('span');
    sev.className = 'finding-severity';
    sev.dataset.severity = f.severity;
    sev.textContent = SEVERITY_LABELS[f.severity] || f.severity;
    const cat = document.createElement('span');
    cat.textContent = f.category;
    head.append(sev, cat);
    li.append(head);
    if (f.evidence) {
      const ev = document.createElement('p');
      ev.className = 'finding-evidence';
      ev.textContent = `原文依据：${f.evidence}`;
      li.append(ev);
    }
    const rec = document.createElement('p');
    rec.className = 'finding-recommendation';
    rec.textContent = f.recommendation;
    li.append(rec);
    container.append(li);
  }
}

function renderSettings(els, state) {
  setText(els.keyState, state.hasKey ? '已保存到本次会话' : '未配置');
  els.btnSaveKey.disabled = state.savingKey;
  els.btnClearKey.disabled = !state.hasKey || state.clearingKey;
  els.clearConfirm.hidden = !state.clearConfirmOpen;
  els.btnClearCancel.disabled = state.clearingKey;
  els.btnClearConfirm.disabled = state.clearingKey;
  els.iconEye.hidden = state.keyVisible;
  els.iconEyeOff.hidden = !state.keyVisible;
  els.btnToggleKey.setAttribute('aria-label', state.keyVisible ? '隐藏 Key' : '显示 Key');
  els.btnToggleKey.setAttribute('aria-pressed', String(state.keyVisible));
  els.keyInput.type = state.keyVisible ? 'text' : 'password';
}

/** 将完整状态渲染到 DOM。 */
export function renderView(els, state) {
  const isSettings = state.view === 'settings';
  els.viewMain.hidden = isSettings;
  els.viewSettings.hidden = !isSettings;
  els.btnBack.hidden = !isSettings;
  els.btnSettings.hidden = isSettings;
  els.viewTitle.textContent = isSettings ? '设置' : 'Gemini 速审助手';

  els.direction.hidden = state.mode !== 'translate';
  const hasText = state.text.trim() !== '';
  els.sourceEmpty.hidden = hasText;
  els.sourceText.hidden = !hasText;
  els.btnExpand.hidden = !hasText;
  els.sourceCount.textContent = String(state.text.trim().length);
  setText(els.sourceText, state.text);
  els.sourceText.classList.toggle('expanded', state.expanded);
  els.btnExpand.textContent = state.expanded ? '收起' : '展开';
  els.btnExpand.setAttribute('aria-expanded', String(state.expanded));

  const loading = state.taskState === 'loading';
  els.btnPrimary.disabled = !hasText && !loading;
  els.btnPrimaryLabel.textContent = loading ? '取消' : MODE_PRIMARY_LABELS[state.mode];
  els.iconPlay.hidden = loading;
  els.iconStop.hidden = !loading;
  setText(els.status, state.statusText);

  els.resultEmpty.hidden = true;
  els.resultLoading.hidden = true;
  els.resultError.hidden = true;
  els.resultSuccess.hidden = true;
  els.result.setAttribute('aria-busy', String(loading));

  if (loading) {
    els.resultLoading.hidden = false;
    setText(els.loadingText, MODE_LOADING_LABELS[state.mode]);
  } else if (state.taskState === 'error' && state.error) {
    els.resultError.hidden = false;
    setText(els.errorMessage, state.error.message || '请求未完成。下一步：重试。');
    const missingKey = state.error.kind === 'MISSING_KEY';
    els.btnErrorAction.hidden = !(state.error.retryable || missingKey);
    setText(els.btnErrorAction, missingKey ? '去设置' : '重试');
  } else if ((state.taskState === 'success' || state.taskState === 'stale') && state.result && state.meta) {
    els.resultSuccess.hidden = false;
    els.staleBar.hidden = state.taskState !== 'stale';
    els.demoBar.hidden = !state.meta.demo;
    const source = state.meta.demo ? '离线演示，非 Gemini API 结果' : 'Gemini API';
    setText(
      els.resultMeta,
      `${MODE_LABELS[state.result.mode]} · ${source} · ${timeLabel(state.meta.generatedAt)}`,
    );
    let output = state.result.output;
    if (state.result.mode === 'security' && !output.includes(SECURITY_NOTE)) {
      output = `${output}\n${SECURITY_NOTE}`;
    }
    setText(els.resultOutput, output);
    renderFindings(els.resultFindings, state.result.findings || []);
    els.btnCopy.disabled = state.taskState === 'stale';
    setText(els.copyFeedback, state.copyFeedback);
  } else {
    els.resultEmpty.hidden = false;
    setText(
      els.resultEmptyText,
      hasText
        ? '点击上方按钮开始分析。结果会标注来源、模式与时间。'
        : '选择模式后点击上方按钮开始。结果会标注来源、模式与时间。',
    );
  }

  renderSettings(els, state);
}

/** 结果的纯文本序列化（复制 / 导出；演示必须标注来源）。 */
export function resultToText({ result, meta }) {
  const lines = [
    `模式：${MODE_LABELS[result.mode] || result.mode}`,
    `来源：${meta.demo ? '离线演示，非 Gemini API 结果' : 'Gemini API'}`,
    `时间：${timeLabel(meta.generatedAt)}`,
    '',
    result.output,
  ];
  if (result.findings && result.findings.length > 0) {
    lines.push('');
    for (const f of result.findings) {
      lines.push(`- [${SEVERITY_LABELS[f.severity] || f.severity}] ${f.category}`);
      if (f.evidence) lines.push(`  原文依据：${f.evidence}`);
      lines.push(`  ${f.recommendation}`);
    }
  }
  return lines.join('\n');
}
