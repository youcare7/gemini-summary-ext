import { test, expect, seedSelection, openPopup } from './fixtures.js';
import { INPUTS } from '../fixtures/inputs.js';
import path from 'node:path';
import fs from 'node:fs';

const shotsDir = path.resolve('assets/screenshots');
if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

test('take 3 screenshots', async ({ context, extensionId, serviceWorker }) => {
  // 01: idle popup (no selection)
  const p1 = await openPopup(context, extensionId);
  await p1.waitForTimeout(300);
  await p1.screenshot({ path: path.join(shotsDir, '01-popup-idle.png'), fullPage: true });
  console.log('01 saved');
  await p1.close();

  // 02: summary result via offline demo
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const p2 = await openPopup(context, extensionId);
  await p2.waitForTimeout(300);
  await p2.locator('#btn-settings').click();
  await p2.locator('#btn-demo').click();
  await p2.locator('#btn-primary').click();
  await p2.waitForTimeout(1000);
  await p2.screenshot({ path: path.join(shotsDir, '02-result-summary.png'), fullPage: true });
  console.log('02 saved');

  // 03: settings page
  const p3 = await openPopup(context, extensionId);
  await p3.locator('#btn-settings').click();
  await p3.waitForTimeout(300);
  await p3.screenshot({ path: path.join(shotsDir, '03-settings.png'), fullPage: true });
  console.log('03 saved');
});
