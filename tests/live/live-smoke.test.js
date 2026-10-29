// 真实 API 评估（默认跳过）：仅当 RUN_LIVE_GEMINI=1 且 GEMINI_API_KEY 存在时执行。
// 只输出用例 ID、耗时、模型与脱敏错误；不输出 Key、原文、模型输出或完整响应。
// OPEN-001/OPEN-002 未解除前，失败记录为 blocked，不允许改成假通过。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../src/services/analysis-service.js';
import { DEFAULT_MODEL, MAX_INPUT } from '../../src/config/defaults.js';
import { SECURITY_DISCLAIMER } from '../../src/contracts/result-schema.js';
import { INPUTS, makeLongText } from '../fixtures/inputs.js';
import { LIVE_CASES } from '../fixtures/live-cases.js';

const enabled = process.env.RUN_LIVE_GEMINI === '1' && Boolean(process.env.GEMINI_API_KEY);
const boundaryEnabled = enabled && process.env.RUN_LIVE_BOUNDARY === '1';
const apiKey = process.env.GEMINI_API_KEY || null;
const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

function logOutcome(id, startedAt, result) {
  const elapsed = Date.now() - startedAt;
  if (result.ok) {
    console.log(`[live] case=${id} outcome=pass model=${model} elapsed_ms=${elapsed} findings=${result.result.findings.length}`);
  } else {
    console.log(`[live] case=${id} outcome=blocked model=${model} elapsed_ms=${elapsed} kind=${result.error.kind} status=${result.error.status ?? 'n/a'}`);
  }
}

function assertHardContract(result, testCase) {
  assert.equal(result.mode, testCase.mode);
  if (testCase.mode !== 'security') {
    assert.deepEqual(result.findings, []);
  } else {
    assert.ok(result.output.includes(SECURITY_DISCLAIMER), '真实安全结果缺少固定免责声明');
    for (const finding of result.findings) {
      if (finding.severity !== 'info') {
        assert.ok(finding.evidence.length > 0, '非 info 风险结论缺少原文依据');
      }
      if (finding.evidence !== '') {
        assert.ok(testCase.text.includes(finding.evidence), '真实结果包含伪造 evidence');
      }
    }
  }
  for (const expected of testCase.expectContains || []) {
    assert.ok(result.output.includes(expected), `译文缺少必须保留的标识：${expected}`);
  }
}

for (const testCase of LIVE_CASES) {
  test(`真实 Gemini 评估：${testCase.id}`, { skip: !enabled }, async () => {
    const startedAt = Date.now();
    const result = await analyze({
      text: testCase.text,
      mode: testCase.mode,
      targetLanguage: testCase.targetLanguage,
      apiKey,
      model,
    });
    logOutcome(testCase.id, startedAt, result);
    assert.equal(result.ok, true, `真实推理未通过：${result.error && result.error.kind}`);
    assertHardContract(result.result, testCase);
  });
}

// 大输入会显著增加延迟与 token 消耗，默认不随常规 live 评估运行。
test('真实 Gemini 边界：恰好 10,000 字符可提交', { skip: !boundaryEnabled }, async () => {
  const text = makeLongText(MAX_INPUT);
  const startedAt = Date.now();
  const result = await analyze({ text, mode: 'summary', apiKey, model });
  logOutcome('summary-max-input', startedAt, result);
  assert.equal(result.ok, true, `边界真实推理未通过：${result.error && result.error.kind}`);
  assert.equal(result.result.mode, 'summary');
});

// 保持最小冒烟的独立入口，便于 OPEN-001 只验证一次最小真实请求。
test('真实 Gemini 最小推理冒烟（summary）', { skip: !enabled }, async () => {
  const startedAt = Date.now();
  const result = await analyze({ text: INPUTS.summaryZh, mode: 'summary', apiKey, model });
  logOutcome('summary-minimal', startedAt, result);
  assert.equal(result.ok, true, `真实推理未通过：${result.error && result.error.kind}`);
});
