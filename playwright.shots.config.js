// 截图脚本专用配置：只收集 scripts/gen-screenshots.mjs，不进入 E2E 套件。
// 运行：npx playwright test --config playwright.shots.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: /gen-screenshots\.mjs$/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    serviceWorkers: 'allow',
  },
});
