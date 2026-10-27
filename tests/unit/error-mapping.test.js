// error-mapping 单测：HTTP/异常 -> 错误类别与用户可读下一步（node:test）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHttpStatus, normalizeError, buildError } from '../../src/services/error-mapping.js';
import { ERROR_KINDS } from '../../src/contracts/messages.js';

test('401 -> INVALID_KEY，不自动重试', () => {
  const e = classifyHttpStatus(401);
  assert.equal(e.kind, 'INVALID_KEY');
  assert.equal(e.retryable, false);
  assert.match(e.message, /API Key 未通过验证/);
});

test('400 安全拦截 -> CONTENT_BLOCKED；其他 400 -> INVALID_REQUEST', () => {
  const blocked = classifyHttpStatus(400, 'Request blocked due to SAFETY reasons');
  assert.equal(blocked.kind, 'CONTENT_BLOCKED');
  const other = classifyHttpStatus(400, 'Invalid argument: input');
  assert.equal(other.kind, 'INVALID_REQUEST');
  assert.equal(other.retryable, false);
});

test('403 免费层文案 -> PERMISSION_DENIED 且不归因于模型/Key 格式', () => {
  const e = classifyHttpStatus(403, 'Project does not have free tier eligibility for this API');
  assert.equal(e.kind, 'PERMISSION_DENIED');
  assert.match(e.message, /免费层资格/);
  assert.match(e.message, /项目/);
  assert.doesNotMatch(e.message, /模型不可用|Key 无效|格式错误|已下线/);
  const other = classifyHttpStatus(403, 'Permission denied on resource');
  assert.equal(other.kind, 'PERMISSION_DENIED');
  assert.equal(other.retryable, false);
});

test('404 -> MODEL_UNAVAILABLE', () => {
  const e = classifyHttpStatus(404);
  assert.equal(e.kind, 'MODEL_UNAVAILABLE');
});

test('429 -> RATE_LIMITED 且可重试', () => {
  const e = classifyHttpStatus(429);
  assert.equal(e.kind, 'RATE_LIMITED');
  assert.equal(e.retryable, true);
});

test('5xx -> UPSTREAM_UNAVAILABLE；408 -> TIMEOUT', () => {
  for (const status of [500, 502, 503, 504]) {
    const e = classifyHttpStatus(status);
    assert.equal(e.kind, 'UPSTREAM_UNAVAILABLE');
    assert.equal(e.retryable, true);
  }
  assert.equal(classifyHttpStatus(408).kind, 'TIMEOUT');
});

test('normalizeError：AbortError -> TIMEOUT；未知异常 -> NETWORK', () => {
  const abort = new Error('aborted');
  abort.name = 'AbortError';
  assert.equal(normalizeError(abort).kind, 'TIMEOUT');
  assert.equal(normalizeError(new Error('boom')).kind, 'NETWORK');
});

test('normalizeError 透传带 kind 的内部错误', () => {
  const e = normalizeError(buildError('MALFORMED_RESPONSE', { status: 200 }));
  assert.equal(e.kind, 'MALFORMED_RESPONSE');
});

test('所有错误类别均有面向用户的下一步文案，且不含敏感占位', () => {
  for (const kind of ERROR_KINDS) {
    const err = normalizeError({ kind, message: '' });
    assert.ok(err.message.length > 0, `${kind} 缺少用户文案`);
    assert.match(err.message, /下一步/, `${kind} 文案缺少下一步`);
    assert.doesNotMatch(err.message, /sk-|AIza|api[_-]?key=/i);
  }
});
