// 真实 API 冒烟（默认跳过）：仅当 RUN_LIVE_GEMINI=1 且 GEMINI_API_KEY 存在时执行。
// 只输出状态码、模型与脱敏错误；不输出 Key、原文与完整响应。
// OPEN-001/OPEN-002 未解除前，失败记录为 blocked，不允许改成假通过。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../src/services/analysis-service.js';
import { INPUTS } from '../fixtures/inputs.js';

const enabled = process.env.RUN_LIVE_GEMINI === '1' && Boolean(process.env.GEMINI_API_KEY);
const apiKey = process.env.GEMINI_API_KEY || null;

test('真实 Gemini 最小推理冒烟（summary）', { skip: !enabled }, async () => {
  const r = await analyze({
    text: INPUTS.summaryZh,
    mode: 'summary',
    apiKey,
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  });
  if (!r.ok) {
    // 只记录脱敏诊断：类别 + 状态码
    console.log(`[live] blocked: kind=${r.error.kind} status=${r.error.status}`);
  }
  assert.equal(r.ok, true, `真实推理未通过：${r.error && r.error.kind}`);
});
