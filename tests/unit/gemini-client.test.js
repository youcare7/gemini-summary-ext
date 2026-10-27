// gemini-client 契约单测：注入 fake fetch，断言端点/Header/store=false/steps 提取/重试/超时/取消。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  callInteractions,
  extractModelText,
  backoffMs,
  GeminiApiError,
} from '../../src/infrastructure/gemini-client.js';
import { buildRequestBody } from '../../src/services/prompt-builder.js';
import { wrapInteraction, wrapResult, validSummary } from '../fixtures/outputs.js';
import { INPUTS } from '../fixtures/inputs.js';

const BODY = buildRequestBody({ text: INPUTS.summaryZh, mode: 'summary' });

function fakeFetchSequence(responses) {
  const calls = [];
  let i = 0;
  const fn = async (url, options) => {
    calls.push({ url, options });
    const item = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (item instanceof Error) throw item;
    return item;
  };
  fn.calls = calls;
  return fn;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('请求契约：POST 端点、x-goog-api-key、Api-Revision、store=false stream=false', async () => {
  const fetchFn = fakeFetchSequence([jsonResponse(200, wrapResult(validSummary))]);
  await callInteractions({
    apiKey: 'TEST-FAKE-KEY',
    body: BODY,
    fetchFn,
    sleepFn: async () => {},
    randomFn: () => 0,
  });
  assert.equal(fetchFn.calls.length, 1);
  const { url, options } = fetchFn.calls[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['x-goog-api-key'], 'TEST-FAKE-KEY');
  assert.equal(options.headers['Api-Revision'], '2026-05-20');
  assert.equal(options.headers['Content-Type'], 'application/json');
  const sent = JSON.parse(options.body);
  assert.equal(sent.store, false);
  assert.equal(sent.stream, false);
});

test('steps 提取：取最后一个 model_output，合并其 content 的 text', () => {
  const interaction = {
    status: 'completed',
    steps: [
      { type: 'model_output', content: [{ type: 'text', text: '早前的步骤不应被读取' }] },
      { type: 'tool_call', content: [{ type: 'text', text: 'ignored' }] },
      {
        type: 'model_output',
        content: [
          { type: 'text', text: '{"mode":"summary",' },
          { type: 'image', text: 'ignored-type' },
          { type: 'text', text: '"output":"x","findings":[]}' },
        ],
      },
    ],
  };
  assert.equal(extractModelText(interaction), '{"mode":"summary","output":"x","findings":[]}');
});

test('steps 提取失败：status 非 completed / 无 model_output / 无 text / 非对象 -> null', () => {
  assert.equal(extractModelText(null), null);
  assert.equal(extractModelText({ status: 'failed', steps: [] }), null);
  assert.equal(extractModelText({ status: 'completed', steps: [{ type: 'user_input' }] }), null);
  assert.equal(
    extractModelText({
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'image' }] }],
    }),
    null,
  );
  assert.equal(extractModelText({ status: 'completed' }), null);
});

test('429 重试最多 2 次后仍失败则抛 RATE_LIMITED', async () => {
  const fetchFn = fakeFetchSequence([
    jsonResponse(429, { error: { code: 429, message: 'quota' } }),
    jsonResponse(429, { error: { code: 429, message: 'quota' } }),
    jsonResponse(429, { error: { code: 429, message: 'quota' } }),
    jsonResponse(200, wrapResult(validSummary)),
  ]);
  const sleeps = [];
  await assert.rejects(
    callInteractions({
      apiKey: 'TEST-FAKE-KEY',
      body: BODY,
      fetchFn,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
      randomFn: () => 0,
    }),
    (err) => {
      assert.ok(err instanceof GeminiApiError);
      assert.equal(err.kind, 'RATE_LIMITED');
      return true;
    },
  );
  assert.equal(fetchFn.calls.length, 3); // 1 次原始 + 2 次重试
  assert.equal(sleeps.length, 2);
});

test('5xx 可重试后成功；4xx 不自动重试', async () => {
  const okFetch = fakeFetchSequence([
    jsonResponse(503, { error: { code: 503, message: 'unavailable' } }),
    jsonResponse(200, wrapResult(validSummary)),
  ]);
  const ok = await callInteractions({
    apiKey: 'TEST-FAKE-KEY',
    body: BODY,
    fetchFn: okFetch,
    sleepFn: async () => {},
    randomFn: () => 0,
  });
  assert.equal(okFetch.calls.length, 2);
  assert.equal(ok.status, 'completed');

  const badFetch = fakeFetchSequence([
    jsonResponse(403, { error: { code: 403, message: 'denied' } }),
    jsonResponse(200, wrapResult(validSummary)),
  ]);
  await assert.rejects(
    callInteractions({
      apiKey: 'TEST-FAKE-KEY',
      body: BODY,
      fetchFn: badFetch,
      sleepFn: async () => {},
      randomFn: () => 0,
    }),
    (err) => err.kind === 'PERMISSION_DENIED',
  );
  assert.equal(badFetch.calls.length, 1);
});

test('网络错误可重试，重试耗尽抛 NETWORK', async () => {
  const netFetch = fakeFetchSequence([new TypeError('Failed to fetch')]);
  await assert.rejects(
    callInteractions({
      apiKey: 'TEST-FAKE-KEY',
      body: BODY,
      fetchFn: netFetch,
      sleepFn: async () => {},
      randomFn: () => 0,
    }),
    (err) => err.kind === 'NETWORK',
  );
  assert.equal(netFetch.calls.length, 3);
});

test('外部取消 -> CANCELLED，不再发起请求', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchFn = fakeFetchSequence([jsonResponse(200, wrapResult(validSummary))]);
  await assert.rejects(
    callInteractions({
      apiKey: 'TEST-FAKE-KEY',
      body: BODY,
      signal: controller.signal,
      fetchFn,
      sleepFn: async () => {},
    }),
    (err) => err.kind === 'CANCELLED',
  );
  assert.equal(fetchFn.calls.length, 0);
});

test('请求超时（内部 AbortController）-> TIMEOUT，不自动重试', async () => {
  const hangFetch = (url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  await assert.rejects(
    callInteractions({
      apiKey: 'TEST-FAKE-KEY',
      body: BODY,
      fetchFn: hangFetch,
      sleepFn: async () => {},
      timeoutMs: 20,
    }),
    (err) => {
      assert.equal(err.kind, 'TIMEOUT');
      assert.equal(err.retryable, true);
      return true;
    },
  );
});

test('响应体非 JSON -> MALFORMED_RESPONSE', async () => {
  const fetchFn = fakeFetchSequence([
    {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    },
  ]);
  await assert.rejects(
    callInteractions({
      apiKey: 'TEST-FAKE-KEY',
      body: BODY,
      fetchFn,
      sleepFn: async () => {},
    }),
    (err) => err.kind === 'MALFORMED_RESPONSE',
  );
});

test('退避：1s 起步、指数增长、8s 上限、带抖动', () => {
  assert.equal(backoffMs(0, () => 0), 1000);
  assert.equal(backoffMs(1, () => 0), 2000);
  assert.equal(backoffMs(2, () => 0), 4000);
  assert.equal(backoffMs(3, () => 0), 8000);
  assert.equal(backoffMs(10, () => 0), 8000);
  assert.equal(backoffMs(0, () => 1), 1000 + 250);
});

test('交互包装样例可被提取（fixtures 自洽）', () => {
  const text = extractModelText(wrapInteraction(JSON.stringify(validSummary)));
  assert.deepEqual(JSON.parse(text), validSummary);
});
