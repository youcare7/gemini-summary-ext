// key-store / task-store 单测：内存 chrome mock 验证 session-only Key 与任务状态。
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as keyStore from '../../src/infrastructure/key-store.js';
import * as taskStore from '../../src/infrastructure/task-store.js';

function createChromeMock() {
  const areas = {
    session: new Map(),
    local: new Map(),
    sync: new Map(),
  };
  const makeArea = (name) => ({
    async get(key) {
      const map = areas[name];
      if (typeof key === 'string') {
        return map.has(key) ? { [key]: map.get(key) } : {};
      }
      return Object.fromEntries([...map.entries()]);
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) areas[name].set(k, v);
    },
    async remove(key) {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) areas[name].delete(k);
    },
  });
  return { storage: { session: makeArea('session'), local: makeArea('local'), sync: makeArea('sync') }, areas };
}

beforeEach(() => {
  globalThis.chrome = createChromeMock();
});

test('Key 仅写入 session，不落 local/sync，不回显', async () => {
  await keyStore.saveKey('FAKE-KEY-123');
  assert.equal(globalThis.chrome.areas.session.get('geminiApiKey'), 'FAKE-KEY-123');
  assert.equal(globalThis.chrome.areas.local.has('geminiApiKey'), false);
  assert.equal(globalThis.chrome.areas.sync.has('geminiApiKey'), false);
  assert.equal(await keyStore.hasKey(), true);
});

test('无 Key 时 getKey 返回 null', async () => {
  assert.equal(await keyStore.getKey(), null);
  assert.equal(await keyStore.hasKey(), false);
});

test('空字符串 Key 不视为已配置', async () => {
  await keyStore.saveKey('');
  assert.equal(await keyStore.getKey(), null);
});

test('clearKey 同时清理 session Key 与遗留 local Key/旧正文，不动其他偏好', async () => {
  globalThis.chrome.areas.local.set('prefs', { mode: 'summary' });
  globalThis.chrome.areas.local.set('lastSelectedText', '旧正文');
  globalThis.chrome.areas.local.set('geminiApiKey', 'legacy-key');
  await keyStore.saveKey('FAKE-KEY-123');
  await keyStore.clearKey();
  assert.equal(await keyStore.getKey(), null);
  assert.equal(globalThis.chrome.areas.local.has('lastSelectedText'), false);
  assert.equal(globalThis.chrome.areas.local.has('geminiApiKey'), false);
  assert.deepEqual(globalThis.chrome.areas.local.get('prefs'), { mode: 'summary' });
});

test('migrateLegacyData 删除旧持久正文', async () => {
  globalThis.chrome.areas.local.set('lastSelectedText', '旧正文');
  await keyStore.migrateLegacyData();
  assert.equal(globalThis.chrome.areas.local.has('lastSelectedText'), false);
});

test('pendingAnalysis 存 session 而非 local', async () => {
  await taskStore.setPendingAnalysis('选中的文本');
  assert.ok(globalThis.chrome.areas.session.has('pendingAnalysis'));
  assert.equal(globalThis.chrome.areas.local.has('pendingAnalysis'), false);
  const pending = await taskStore.getPendingAnalysis();
  assert.equal(pending.text, '选中的文本');
  await taskStore.clearPendingAnalysis();
  assert.equal(await taskStore.getPendingAnalysis(), null);
});

test('currentTask 快照读写', async () => {
  const task = { requestId: 'r-1', mode: 'summary', status: 'loading', text: 't' };
  await taskStore.setCurrentTask(task);
  assert.deepEqual(await taskStore.getCurrentTask(), task);
});

test('openPopupHint 读后即清', async () => {
  await taskStore.setOpenPopupHint(true);
  assert.equal(await taskStore.takeOpenPopupHint(), true);
  assert.equal(await taskStore.takeOpenPopupHint(), false);
});

test('prefs 保存在 local 且合并写入', async () => {
  await taskStore.savePrefs({ mode: 'security' });
  await taskStore.savePrefs({ targetLanguage: 'en' });
  assert.deepEqual(await taskStore.loadPrefs(), { mode: 'security', targetLanguage: 'en' });
  assert.equal(globalThis.chrome.areas.session.has('prefs'), false);
});
