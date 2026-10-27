// analysis-service 集成单测：组合 prompt -> client -> validate（fake fetch 注入）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../../src/services/analysis-service.js';
import { INPUTS } from '../fixtures/inputs.js';
import {
  validSummary,
  validSecurity,
  invalidResults,
  wrapResult,
  wrapInteraction,
} from '../fixtures/outputs.js';

function fetchReturning(body) {
  return async () => ({ ok: true, status: 200, json: async () => body });
}

test('成功路径返回校验后的结果', async () => {
  const r = await analyze({
    text: INPUTS.summaryZh,
    mode: 'summary',
    apiKey: 'FAKE',
    fetchFn: fetchReturning(wrapResult(validSummary)),
    sleepFn: async () => {},
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.result, validSummary);
});

test('安全模式：伪造 evidence 的响应判 MALFORMED_RESPONSE，不展示虚构依据', async () => {
  const r = await analyze({
    text: INPUTS.securityPhishing,
    mode: 'security',
    apiKey: 'FAKE',
    fetchFn: fetchReturning(wrapResult(invalidResults.forgedEvidence)),
    sleepFn: async () => {},
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'MALFORMED_RESPONSE');
  assert.match(r.error.message, /evidence_not_in_source/);
  assert.doesNotMatch(r.error.message, /这段引文从未出现在原文中/);
});

test('非法 JSON -> MALFORMED_RESPONSE，不伪造成功', async () => {
  const r = await analyze({
    text: INPUTS.summaryZh,
    mode: 'summary',
    apiKey: 'FAKE',
    fetchFn: fetchReturning(wrapInteraction('这不是 JSON {')),
    sleepFn: async () => {},
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'MALFORMED_RESPONSE');
});

test('steps 异常（status 非 completed）-> MALFORMED_RESPONSE', async () => {
  const r = await analyze({
    text: INPUTS.summaryZh,
    mode: 'summary',
    apiKey: 'FAKE',
    fetchFn: fetchReturning(wrapResult(validSummary, { status: 'failed' })),
    sleepFn: async () => {},
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'MALFORMED_RESPONSE');
});

test('未配置 Key：本地拒绝，不发起任何请求', async () => {
  let called = 0;
  const r = await analyze({
    text: INPUTS.summaryZh,
    mode: 'summary',
    apiKey: null,
    fetchFn: async () => {
      called += 1;
      throw new Error('should not fetch');
    },
    sleepFn: async () => {},
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'MISSING_KEY');
  assert.equal(called, 0);
});

test('空输入与超长输入在调用前本地拒绝（含字数提示）', async () => {
  const empty = await analyze({ text: '  ', mode: 'summary', apiKey: 'FAKE', fetchFn: async () => {
    throw new Error('should not fetch');
  } });
  assert.equal(empty.error.kind, 'EMPTY_INPUT');

  const long = await analyze({ text: 'a'.repeat(10001), mode: 'summary', apiKey: 'FAKE', fetchFn: async () => {
    throw new Error('should not fetch');
  } });
  assert.equal(long.error.kind, 'INPUT_TOO_LONG');
  assert.match(long.error.message, /10,001/);
});

test('安全模式合法结果透传 findings（evidence 与原文一致）', async () => {
  const r = await analyze({
    text: INPUTS.securityPhishing,
    mode: 'security',
    apiKey: 'FAKE',
    fetchFn: fetchReturning(wrapResult(validSecurity)),
    sleepFn: async () => {},
  });
  assert.equal(r.ok, true);
  for (const f of r.result.findings) {
    if (f.evidence !== '') assert.ok(INPUTS.securityPhishing.includes(f.evidence));
  }
});
