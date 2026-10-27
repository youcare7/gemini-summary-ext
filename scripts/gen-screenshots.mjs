// 截图生成脚本（手动运行，不属于 E2E 套件，文件名不含 .spec 故不会被自动收集）。
// 运行：npx playwright test scripts/gen-screenshots.mjs --config playwright.config.js
// viewport 固定 320px 宽（扩展弹窗真实宽度），避免截出 1280px 宽的大片空白。
import { test, seedSelection, openPopup } from '../tests/e2e/fixtures.js';
import { INPUTS } from '../tests/fixtures/inputs.js';
import path from 'node:path';
import fs from 'node:fs';

const shotsDir = path.resolve('assets/screenshots');
if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

async function shoot(page, name) {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.waitForTimeout(300);
  // 按真实内容高度收紧 viewport，避免内容不足一屏时底部留大片背景
  const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  if (h > 120 && h < 1600 && h !== 600) {
    await page.setViewportSize({ width: 320, height: h });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: false });
  console.log(name + ' saved');
}

test('take 3 screenshots', async ({ context, extensionId, serviceWorker }) => {
  // 01: 空态弹窗（无选中文本）
  const p1 = await openPopup(context, extensionId);
  await shoot(p1, '01-popup-idle.png');
  await p1.close();

  // 02: 离线演示的摘要结果（必须带"离线演示，非 Gemini API 结果"标注）
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const p2 = await openPopup(context, extensionId);
  await p2.locator('#btn-settings').click();
  await p2.locator('#btn-demo').click();
  await p2.locator('#btn-primary').click();
  await p2.waitForTimeout(1000);
  await shoot(p2, '02-result-summary.png');
  await p2.close();

  // 03: 设置页（Key 输入框必须为空）
  const p3 = await openPopup(context, extensionId);
  await p3.locator('#btn-settings').click();
  await shoot(p3, '03-settings.png');
});
