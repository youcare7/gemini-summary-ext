// 内部消息契约（Spec §5）：chrome.runtime 消息类型与载荷工厂。
// 所有消息与结果 Schema 独立放在 contracts 层，业务代码不得另行定义类型字符串。

/** popup -> background：发起分析（不自动重放；旧请求会被 AbortController 取消）。 */
export const ANALYZE_REQUEST = 'ANALYZE_REQUEST';

/** background -> popup：分析结果（成功或失败），按 requestId 绑定来源任务。 */
export const ANALYZE_RESPONSE = 'ANALYZE_RESPONSE';

/** popup -> background：取消当前分析任务（UIUX 5.1 "可取消"；扩展 Spec 最小集合）。 */
export const ANALYZE_CANCEL = 'ANALYZE_CANCEL';

/** popup -> background：保存 API Key 到会话（值不回显、不写日志）。 */
export const SAVE_KEY = 'SAVE_KEY';

/** popup -> background：清除会话中的 API Key。 */
export const CLEAR_KEY = 'CLEAR_KEY';

/** popup -> background：读取当前会话状态（待分析文本、任务状态、是否已配置 Key）。 */
export const GET_STATE = 'GET_STATE';

/** 错误类别枚举（ARCHITECTURE §10 锁定）。 */
export const ERROR_KINDS = Object.freeze([
  'MISSING_KEY',
  'INVALID_KEY',
  'INVALID_REQUEST',
  'PERMISSION_DENIED',
  'MODEL_UNAVAILABLE',
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK',
  'UPSTREAM_UNAVAILABLE',
  'CONTENT_BLOCKED',
  'MALFORMED_RESPONSE',
  'EMPTY_INPUT',
  'INPUT_TOO_LONG',
  'CANCELLED',
]);

/** 任务模式枚举（与 result-schema 的 mode 一致）。 */
export const MODES = Object.freeze(['summary', 'security', 'translate']);

/** 构造 ANALYZE_REQUEST 载荷。 */
export function createAnalyzeRequest({ requestId, mode, text, targetLanguage }) {
  return { type: ANALYZE_REQUEST, requestId, mode, text, targetLanguage };
}

/** 构造成功 ANALYZE_RESPONSE 载荷。 */
export function createSuccessResponse({ requestId, result, meta }) {
  return { type: ANALYZE_RESPONSE, requestId, ok: true, result, meta };
}

/** 构造失败 ANALYZE_RESPONSE 载荷。 */
export function createErrorResponse({ requestId, error }) {
  return { type: ANALYZE_RESPONSE, requestId, ok: false, error };
}

/**
 * 构造错误对象（面向用户的具体原因与下一步）。
 * @param {string} kind ERROR_KINDS 之一
 * @param {object} [opts]
 * @param {number} [opts.status] HTTP 状态码（本地错误为 0）
 * @param {boolean} [opts.retryable] 用户手动重试是否有意义
 * @param {string} [opts.message] 面向用户的原因与下一步
 */
export function createError(kind, { status = 0, retryable = false, message = '' } = {}) {
  return { kind, status, retryable, message };
}
