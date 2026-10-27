import { defineConfig } from '@playwright/test';

// 扩展 E2E：persistent Chromium + context.route 拦截 Service Worker 发往 Gemini 的请求。
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    serviceWorkers: 'allow',
  },
});
