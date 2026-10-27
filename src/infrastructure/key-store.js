// Key 存储（Spec：Key 仅 chrome.storage.session，不提供持久化"记住我"）。
// 不回显、不写日志；清除时同时清理历史遗留的 local Key 与旧正文。

const KEY_NAME = 'geminiApiKey';

/** 保存 Key 到本次浏览器会话（chrome.storage.session）。 */
export async function saveKey(key) {
  await chrome.storage.session.set({ [KEY_NAME]: key });
}

/** 读取 Key；无则返回 null。调用方不得打印返回值。 */
export async function getKey() {
  const data = await chrome.storage.session.get(KEY_NAME);
  const value = data[KEY_NAME];
  return typeof value === 'string' && value !== '' ? value : null;
}

/** 是否已配置 Key。 */
export async function hasKey() {
  return (await getKey()) !== null;
}

/**
 * 清除本扩展中的 Key：移除 session Key，并清理遗留 local Key/旧正文。
 * 只做单项 remove，不清空其他设置。
 */
export async function clearKey() {
  await chrome.storage.session.remove(KEY_NAME);
  await chrome.storage.local.remove([KEY_NAME, 'lastSelectedText']);
}

/** 初始升级清理：删除旧版持久化的选中文本（不迁移正文）。 */
export async function migrateLegacyData() {
  await chrome.storage.local.remove('lastSelectedText');
}
