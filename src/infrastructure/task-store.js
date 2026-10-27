// 任务状态存储（chrome.storage.session：pendingAnalysis / currentTask）。
// 非敏感偏好（模式、目标语言）持久化在 chrome.storage.local。
// 正文与任务状态不进入 local/sync，不写日志。

const PENDING = 'pendingAnalysis';
const CURRENT = 'currentTask';
const HINT = 'openPopupHint';

/** 保存右键捕获的选中文本（会话级）。 */
export async function setPendingAnalysis(text) {
  await chrome.storage.session.set({
    [PENDING]: { text, capturedAt: Date.now() },
  });
}

/** 读取待分析文本；无则返回 null。 */
export async function getPendingAnalysis() {
  const data = await chrome.storage.session.get(PENDING);
  return data[PENDING] && typeof data[PENDING].text === 'string' ? data[PENDING] : null;
}

/** 清除待分析文本。 */
export async function clearPendingAnalysis() {
  await chrome.storage.session.remove(PENDING);
}

/**
 * 保存当前任务快照。
 * @param {object} task { requestId, mode, targetLanguage, text, status: 'loading'|'success'|'error', result, meta, error }
 */
export async function setCurrentTask(task) {
  await chrome.storage.session.set({ [CURRENT]: task });
}

/** 读取当前任务快照；无则返回 null。 */
export async function getCurrentTask() {
  const data = await chrome.storage.session.get(CURRENT);
  return data[CURRENT] || null;
}

/** 标记 openPopup 失败提示（下次打开弹窗时展示"请点击扩展图标"）。 */
export async function setOpenPopupHint(value) {
  await chrome.storage.session.set({ [HINT]: Boolean(value) });
}

/** 读取并清除 openPopup 失败提示。 */
export async function takeOpenPopupHint() {
  const data = await chrome.storage.session.get(HINT);
  if (data[HINT]) await chrome.storage.session.remove(HINT);
  return Boolean(data[HINT]);
}

const PREFS_KEY = 'prefs';

/** 读取非敏感偏好（模式、目标语言），存于 storage.local。 */
export async function loadPrefs() {
  const data = await chrome.storage.local.get(PREFS_KEY);
  return data[PREFS_KEY] || {};
}

/** 保存非敏感偏好（仅模式与目标语言）。 */
export async function savePrefs(partial) {
  const current = await loadPrefs();
  await chrome.storage.local.set({ [PREFS_KEY]: { ...current, ...partial } });
}
