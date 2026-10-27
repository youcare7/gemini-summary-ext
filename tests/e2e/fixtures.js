// 扩展 E2E 公共夹具：persistent Chromium 加载 unpacked 扩展（Playwright 官方推荐方式）。
import { test as base, chromium, expect } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EXTENSION_PATH = path.resolve(__dirname, '../..');

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-ext-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;
    await use(extensionId);
  },

  serviceWorker: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
    await use(serviceWorker);
  },
});

/** 通过 Service Worker 上下文模拟右键菜单写入的会话选中文本。 */
export async function seedSelection(serviceWorker, text) {
  await serviceWorker.evaluate(async (value) => {
    await chrome.storage.session.set({ pendingAnalysis: { text: value, capturedAt: Date.now() } });
  }, text);
}

/** 打开 popup 页面。 */
export async function openPopup(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('h1')).toHaveText(/Gemini 速审助手|设置/);
  return page;
}

/** 拦截 Gemini API 并记录调用次数；respondFn(status, body) 返回响应描述。 */
export async function mockGemini(context, respondFn) {
  const calls = [];
  await context.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const request = route.request();
    calls.push({
      url: request.url(),
      headers: request.headers(),
      body: request.postDataJSON(),
    });
    const spec = respondFn(request);
    if (spec.abort) {
      await route.abort(spec.abort);
      return;
    }
    await route.fulfill({
      status: spec.status || 200,
      contentType: 'application/json',
      body: JSON.stringify(spec.body),
    });
  });
  return calls;
}

export { expect };
