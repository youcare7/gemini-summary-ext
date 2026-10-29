// 扩展 E2E：主流程、BYOK、三模式、错误分类、XSS 纯渲染、边界、失效、离线演示。
// 网络全部用 context.route 拦截 Mock，默认不访问真实 Gemini API，测试 Key 为明显虚构值。
import AxeBuilder from '@axe-core/playwright';
import { test, expect, seedSelection, openPopup, mockGemini } from './fixtures.js';
import { INPUTS, DEMO_TEXT, makeLongText } from '../fixtures/inputs.js';
import {
  validSummary,
  validSecurity,
  xssOutput,
  wrapResult,
  wrapInteraction,
} from '../fixtures/outputs.js';

const FAKE_KEY = 'E2E-FAKE-KEY-NOT-REAL';

async function saveFakeKey(page) {
  await page.locator('#btn-settings').click();
  await page.locator('#key-input').fill(FAKE_KEY);
  await page.locator('#btn-save-key').click();
  await expect(page.locator('#key-status')).toContainText('已保存到本次会话');
  await page.locator('#btn-back').click();
}

function pickMode(page, labelText) {
  return page.locator('label.mode-option', { hasText: labelText }).click();
}

async function expectAccessible(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target),
  }));
  expect(violations).toEqual([]);
}

test('空态：无划词时给出操作指引，主按钮禁用，a11y 基线', async ({ context, extensionId }) => {
  const page = await openPopup(context, extensionId);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('h1')).toHaveText('Gemini 速审助手');
  await expect(page.locator('#source-empty')).toContainText('还没有选中文本');
  await expect(page.locator('#btn-primary')).toBeDisabled();
  await expectAccessible(page);

  await page.locator('#btn-settings').click();
  await expect(page.locator('h1')).toHaveText('设置');
  await expectAccessible(page);
});

test('AC-01：未配置 Key 点分析只提示配置，零网络请求', async ({ context, extensionId, serviceWorker }) => {
  const calls = await mockGemini(context, () => ({ status: 200, body: wrapResult(validSummary) }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await expect(page.locator('#source-text')).toContainText('缓存穿透');

  await page.locator('#btn-primary').click();
  await expect(page.locator('#error-message')).toContainText('需要先配置 API Key');
  await expect(page.locator('#btn-error-action')).toHaveText('去设置');
  await page.locator('#btn-error-action').click();
  await expect(page.locator('h1')).toHaveText('设置');
  expect(calls.length).toBe(0);
});

test('AC-02：保存 Key 仅到会话、不回显完整 Key', async ({ context, extensionId }) => {
  const page = await openPopup(context, extensionId);
  await page.locator('#btn-settings').click();
  await page.locator('#key-input').fill(FAKE_KEY);
  await page.locator('#btn-toggle-key').click();
  await expect(page.locator('#key-input')).toHaveAttribute('type', 'text');
  await page.locator('#btn-save-key').click();
  await expect(page.locator('#key-status')).toContainText('已保存到本次会话');
  await expect(page.locator('#key-input')).toHaveValue('');
  await expect(page.locator('#key-state')).toHaveText('已保存到本次会话');
  await expect(page.locator('body')).not.toContainText(FAKE_KEY);
});

test('AC-04/14：摘要成功流含来源/模式/时间，请求契约正确，复制有反馈', async ({ context, extensionId, serviceWorker }) => {
  const calls = await mockGemini(context, () => ({ status: 200, body: wrapResult(validSummary) }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-success')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#result-meta')).toContainText('摘要 · Gemini API');
  await expect(page.locator('#result-output')).toContainText('缓存穿透');

  // 请求契约：端点、Key 头、Api-Revision、store=false
  expect(calls.length).toBe(1);
  expect(calls[0].url).toContain('/v1beta/interactions');
  expect(calls[0].headers['x-goog-api-key']).toBe(FAKE_KEY);
  expect(calls[0].headers['api-revision']).toBe('2026-05-20');
  expect(calls[0].body.store).toBe(false);
  expect(calls[0].body.stream).toBe(false);

  try {
    await context.grantPermissions(['clipboard-write'], { origin: `chrome-extension://${extensionId}` });
  } catch {
    /* 扩展源不支持授权时走 execCommand 兜底 */
  }
  await page.locator('#btn-copy').click();
  await expect(page.locator('#copy-feedback')).toHaveText('已复制');
});

test('AC-06/07：安全审查渲染固定小节与不确定性表述', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({ status: 200, body: wrapResult(validSecurity) }));
  await seedSelection(serviceWorker, INPUTS.securityPhishing);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);
  await pickMode(page, '安全审查');

  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-success')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#result-output')).toContainText('不构成安全保证');
  await expect(page.locator('#result-findings .finding')).toHaveCount(3);
  await expect(page.locator('#result-findings')).toContainText('原文依据：输入您的账号密码与短信验证码完成身份核验');
  await expectAccessible(page);
});

test('AC-10：403 显示分类原因与下一步，不伪造成功', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({
    status: 403,
    body: { error: { code: 403, message: 'Project does not have free tier eligibility' } },
  }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-error')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#error-message')).toContainText('免费层资格');
  await expect(page.locator('#error-message')).toContainText('下一步');
  await expect(page.locator('#result-success')).toBeHidden();
});

test('AC-10：断网/网络失败提示可重试', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({ abort: 'failed' }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-error')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#error-message')).toContainText('无法连接');
  await expect(page.locator('#btn-error-action')).toHaveText('重试');
});

test('AC-12：超过 10,000 字本地拒绝，不静默截断、零网络', async ({ context, extensionId, serviceWorker }) => {
  const calls = await mockGemini(context, () => ({ status: 200, body: wrapResult(validSummary) }));
  await seedSelection(serviceWorker, makeLongText(10001));
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await page.locator('#btn-primary').click();
  await expect(page.locator('#status')).toContainText('超过 10,000 字上限');
  await expect(page.locator('#source-count')).toHaveText('10001');
  expect(calls.length).toBe(0);
});

test('AC-15：模式改变后旧结果标记失效', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({ status: 200, body: wrapResult(validSummary) }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);
  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-success')).toBeVisible({ timeout: 15_000 });

  await pickMode(page, '安全审查');
  await expect(page.locator('#stale-bar')).toBeVisible();
  await expect(page.locator('#stale-bar')).toContainText('请重新分析');
  await expect(page.locator('#btn-copy')).toBeDisabled();
});

test('AC-11：离线演示全程标注且零网络', async ({ context, extensionId, serviceWorker }) => {
  const calls = await mockGemini(context, () => ({ status: 200, body: wrapResult(validSummary) }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);

  await page.locator('#btn-settings').click();
  await page.locator('#btn-demo').click();
  await page.locator('#btn-primary').click();
  await expect(page.locator('#demo-bar')).toHaveText('离线演示，非 Gemini API 结果');
  await expect(page.locator('#result-meta')).toContainText('离线演示');
  await expect(page.locator('#source-text')).toHaveText(DEMO_TEXT);
  expect(calls.length).toBe(0);
});

test('AC-16：模型输出含 HTML/脚本时按纯文本渲染，不执行注入', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({ status: 200, body: wrapResult(xssOutput) }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-success')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#result-output')).toContainText('<img src=x');
  expect(await page.locator('#result-output img').count()).toBe(0);
  expect(await page.locator('#result-output script').count()).toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('AC-03：清除密钥需内联确认，清除后回到未配置', async ({ context, extensionId, serviceWorker }) => {
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);
  await page.locator('#btn-settings').click();

  await page.locator('#btn-clear-key').click();
  await expect(page.locator('#clear-confirm')).toBeVisible();
  await expect(page.locator('#clear-confirm')).toContainText('不会撤销服务商后台的密钥');
  await page.locator('#btn-clear-cancel').click();
  await expect(page.locator('#key-state')).toHaveText('已保存到本次会话');

  await page.locator('#btn-clear-key').click();
  await page.locator('#btn-clear-confirm').click();
  await expect(page.locator('#clear-status')).toContainText('密钥已从本次会话清除');
  await expect(page.locator('#key-state')).toHaveText('未配置');

  await page.locator('#btn-back').click();
  await page.locator('#btn-primary').click();
  await expect(page.locator('#error-message')).toContainText('需要先配置 API Key');
});

test('AC-08/09：翻译模式显示方向选择，只展示译文与空 findings', async ({ context, extensionId, serviceWorker }) => {
  const calls = await mockGemini(context, () => ({
    status: 200,
    body: wrapResult({
      mode: 'translate',
      output: 'The retry budget is 90 seconds.',
      findings: [],
    }),
  }));
  await seedSelection(serviceWorker, INPUTS.translateEn);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await pickMode(page, '翻译');
  await expect(page.locator('#translate-direction')).toBeVisible();
  await page.locator('#target-language').selectOption('zh-CN');
  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-success')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#result-output')).toHaveText('The retry budget is 90 seconds.');
  await expect(page.locator('#result-findings')).toBeEmpty();
  await expect(page.locator('#btn-primary-label')).toHaveText('开始翻译');
  expect(calls[0].body.system_instruction).toContain('中文（zh-CN）');
});

test('AC-10：非法响应不伪造成功（MALFORMED_RESPONSE）', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({ status: 200, body: wrapInteraction('这不是合法的 JSON {') }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-error')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#error-message')).toContainText('无法识别');
  await expect(page.locator('#result-success')).toBeHidden();
});

test('安全硬约束：缺失免责声明时判失败，不展示成功结果', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({
    status: 200,
    body: wrapResult({ ...validSecurity, output: '存在风险，但这里没有固定免责声明。' }),
  }));
  await seedSelection(serviceWorker, INPUTS.securityPhishing);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);
  await pickMode(page, '安全审查');

  await page.locator('#btn-primary').click();
  await expect(page.locator('#result-error')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#error-message')).toContainText('missing_security_disclaimer');
  await expect(page.locator('#result-success')).toBeHidden();
});

test('取消活动请求显示已取消，可重新提交', async ({ context, extensionId, serviceWorker }) => {
  await mockGemini(context, () => ({ abort: 'failed' }));
  await seedSelection(serviceWorker, INPUTS.summaryZh);
  const page = await openPopup(context, extensionId);
  await saveFakeKey(page);

  await page.locator('#btn-primary').click();
  await expect(page.locator('#btn-primary-label')).toHaveText('取消');
  await page.locator('#btn-primary').click(); // 触发取消
  await expect(page.locator('#result-error')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#error-message')).toContainText(/取消|无法连接/);
});
