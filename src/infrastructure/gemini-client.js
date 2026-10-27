// Gemini Interactions API 客户端（Spec §9）：
// fetch 直连 REST；x-goog-api-key + Api-Revision: 2026-05-20；store:false stream:false；
// 单次超时 30s（AbortController）；429/5xx/网络错误最多重试 2 次（指数退避 + 抖动）。
// 零持久日志：不打印原文、Key、请求头与完整响应。

import {
  API_ENDPOINT,
  API_REVISION,
  MAX_RETRIES,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  TIMEOUT_MS,
  TOTAL_BUDGET_MS,
} from '../config/defaults.js';
import { classifyHttpStatus } from '../services/error-mapping.js';

/** 客户端内部错误（带分类 kind，由 error-mapping 归一为用户可见载荷）。 */
export class GeminiApiError extends Error {
  constructor(kind, { status = 0, retryable = false, userMessage = '' } = {}) {
    super(kind);
    this.name = 'GeminiApiError';
    this.kind = kind;
    this.status = status;
    this.retryable = retryable;
    /** 面向用户的文案（如免费层资格说明）；缺省由 error-mapping 填充类别文案 */
    this.userMessage = userMessage;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 指数退避 + 抖动：base*2^attempt，上限 RETRY_MAX_MS，随机抖动 0~250ms。 */
export function backoffMs(attempt, random = Math.random) {
  const exp = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
  return exp + Math.floor(random() * 250);
}

function isRetryable(err) {
  return Boolean(err && err.retryable);
}

/**
 * 按 steps -> model_output -> content -> text 提取模型文本（2026-05-20 架构）。
 * status 非 completed、结构异常或无文本均返回 null（由上层判 MALFORMED_RESPONSE）。
 */
export function extractModelText(interaction) {
  if (typeof interaction !== 'object' || interaction === null) return null;
  if (interaction.status !== 'completed') return null;
  if (!Array.isArray(interaction.steps)) return null;
  const modelSteps = interaction.steps.filter((s) => s && s.type === 'model_output');
  if (modelSteps.length === 0) return null;
  const last = modelSteps[modelSteps.length - 1];
  if (!last || !Array.isArray(last.content)) return null;
  const parts = last.content
    .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text);
  if (parts.length === 0) return null;
  return parts.join('');
}

/** 从服务端错误响应中安全提取 message（仅用于内部判别，不透出原文）。 */
async function readServerMessage(res) {
  try {
    const data = await res.json();
    if (data && data.error && typeof data.error.message === 'string') return data.error.message;
  } catch {
    /* 响应体非 JSON：忽略 */
  }
  return '';
}

/**
 * 调用一次 Interactions 请求（含超时、重试、提取）。
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {object} opts.body 请求体（由 prompt-builder 构造）
 * @param {AbortSignal} [opts.signal] 外部取消信号
 * @param {typeof fetch} [opts.fetchFn]
 * @param {(ms:number)=>Promise<void>} [opts.sleepFn]
 * @param {()=>number} [opts.randomFn]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxRetries]
 * @returns {Promise<object>} Interaction 对象（未经提取）
 */
export async function callInteractions({
  apiKey,
  body,
  signal,
  fetchFn = fetch,
  sleepFn = delay,
  randomFn = Math.random,
  timeoutMs = TIMEOUT_MS,
  maxRetries = MAX_RETRIES,
}) {
  const startedAt = Date.now();
  let attempt = 0;

  for (;;) {
    if (signal?.aborted) throw new GeminiApiError('CANCELLED', {});
    const elapsed = Date.now() - startedAt;
    if (elapsed >= TOTAL_BUDGET_MS) {
      throw new GeminiApiError('TIMEOUT', { status: 0, retryable: true });
    }

    const attemptController = new AbortController();
    const onAbort = () => attemptController.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => attemptController.abort(), timeoutMs);

    try {
      const res = await fetchFn(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
          'Api-Revision': API_REVISION,
        },
        body: JSON.stringify(body),
        signal: attemptController.signal,
      });

      if (res.ok) {
        let data;
        try {
          data = await res.json();
        } catch {
          throw new GeminiApiError('MALFORMED_RESPONSE', { status: res.status });
        }
        return data;
      }

      const serverMessage = await readServerMessage(res);
      const mapped = classifyHttpStatus(res.status, serverMessage);
      const err = new GeminiApiError(mapped.kind, {
        status: mapped.status,
        retryable: mapped.retryable,
        userMessage: mapped.message,
      });
      if (isRetryable(err) && attempt < maxRetries) {
        attempt += 1;
        await sleepFn(backoffMs(attempt - 1, randomFn));
        continue;
      }
      throw err;
    } catch (err) {
      if (err instanceof GeminiApiError) {
        if (isRetryable(err) && attempt < maxRetries) {
          attempt += 1;
          await sleepFn(backoffMs(attempt - 1, randomFn));
          continue;
        }
        throw err;
      }
      // 外部取消优先
      if (signal?.aborted) throw new GeminiApiError('CANCELLED', {});
      // 请求超时（单次 30s）：不自动重试，允许用户手动重试
      if (attemptController.signal.aborted) {
        throw new GeminiApiError('TIMEOUT', { status: 0, retryable: true });
      }
      // 网络错误：可恢复，最多重试 2 次
      const netErr = new GeminiApiError('NETWORK', { status: 0, retryable: true });
      if (attempt < maxRetries) {
        attempt += 1;
        await sleepFn(backoffMs(attempt - 1, randomFn));
        continue;
      }
      throw netErr;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
