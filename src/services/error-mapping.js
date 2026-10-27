// 错误映射（ARCHITECTURE §10）：HTTP/网络/本地错误 -> 分类 kind + 面向用户的原因与下一步。
// 消息不得包含 Key、请求头、完整正文或完整响应；诊断只保留脱敏类别。

import { createError } from '../contracts/messages.js';

/**
 * 生成错误载荷。message 缺省时填充面向用户的类别文案（含下一步）。
 * @param {string} kind
 * @param {object} [opts]
 * @returns {{kind:string,status:number,retryable:boolean,message:string}}
 */
export function buildError(kind, { status = 0, retryable = false, message = '' } = {}) {
  return createError(kind, { status, retryable, message: message || messageFor(kind) });
}

/** 各错误类别 -> 用户可读说明 + 下一步（UIUX §5.3）。 */
const USER_MESSAGES = {
  MISSING_KEY: '需要先配置 API Key。下一步：打开设置并保存到本次会话。',
  INVALID_KEY: 'API Key 未通过验证。下一步：检查后重新保存；仍失败时到官方后台确认。',
  INVALID_REQUEST: '请求被服务端拒绝。下一步：检查输入内容后重试。',
  PERMISSION_DENIED: '当前项目无法调用此 API。下一步：查看官方项目、模型与地区支持（不提供跨区建议）。',
  MODEL_UNAVAILABLE: '所选模型不可用。下一步：在设置中确认已验证的模型候选。',
  RATE_LIMITED: '请求频率或项目额度暂时受限。下一步：稍后重试，或查看官方额度说明。',
  TIMEOUT: '等待超过 30 秒，本次请求已停止。下一步：可手动重试。',
  NETWORK: '无法连接 Gemini API，请检查网络。下一步：重试；也可进入离线演示。',
  UPSTREAM_UNAVAILABLE: 'Gemini 服务暂时不可用。下一步：稍后重试。',
  CONTENT_BLOCKED: '输入内容被安全策略拦截。下一步：调整输入后重试。',
  MALFORMED_RESPONSE: '服务返回的内容无法识别。下一步：重试；若持续出现请保留脱敏诊断类别。',
  EMPTY_INPUT: '选中文本为空。下一步：请在网页中划选文字后再分析。',
  INPUT_TOO_LONG: '选中文本超过 10,000 字上限。下一步：请缩短选区后重试。',
  CANCELLED: '本次请求已取消。下一步：可重新提交。',
};

function messageFor(kind, extra) {
  const base = USER_MESSAGES[kind] || '请求未完成。下一步：重试；可复制脱敏错误信息。';
  return extra ? `${base}${extra}` : base;
}

/** 429/5xx/408 与可恢复网络错误可自动重试；其余 4xx 不自动重试。 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * 依据 HTTP 状态码与服务端 message 分类（message 仅用于判别安全拦截，不原样透出）。
 * @param {number} status
 * @param {string} [serverMessage] 服务端 error.message（内部判别用，不展示原文）
 */
export function classifyHttpStatus(status, serverMessage = '') {
  const msg = typeof serverMessage === 'string' ? serverMessage : '';
  const retryable = RETRYABLE_STATUS.has(status);

  if (status === 400) {
    const blocked = /safety|blocked|prohibited|content[_ ]?policy|responsible/i.test(msg);
    return blocked
      ? buildError('CONTENT_BLOCKED', { status, retryable: false })
      : buildError('INVALID_REQUEST', { status, retryable: false });
  }
  if (status === 401) return buildError('INVALID_KEY', { status, retryable: false });
  if (status === 403) {
    const freeTier = /free tier|free quota|eligib|not been used|billing/i.test(msg);
    return buildError('PERMISSION_DENIED', {
      status,
      retryable: false,
      message: freeTier
        ? '当前 Google Cloud 项目没有该 API 的免费层资格。下一步：查看官方项目资格与地区支持，不归因于模型或 Key 格式。'
        : undefined,
    });
  }
  if (status === 404) return buildError('MODEL_UNAVAILABLE', { status, retryable: false });
  if (status === 429) return buildError('RATE_LIMITED', { status, retryable: true });
  if (status === 408) return buildError('TIMEOUT', { status, retryable: true });
  if (status >= 500) return buildError('UPSTREAM_UNAVAILABLE', { status, retryable });
  return buildError('INVALID_REQUEST', { status, retryable: false });
}

/**
 * 将 client/网络层捕获的异常归一为错误载荷。
 * @param {unknown} err
 */
export function normalizeError(err) {
  if (err && typeof err === 'object') {
    const kind = /** @type {any} */ (err).kind;
    if (typeof kind === 'string' && kind in USER_MESSAGES) {
      return buildError(kind, {
        status: /** @type {any} */ (err).status || 0,
        retryable: Boolean(/** @type {any} */ (err).retryable),
        // 只信任显式的用户文案（如免费层资格说明），内部英文诊断不透出
        message: /** @type {any} */ (err).userMessage || '',
      });
    }
    if (/** @type {any} */ (err).name === 'AbortError' || /** @type {any} */ (err).name === 'TimeoutError') {
      return buildError('TIMEOUT', { status: 0, retryable: true });
    }
  }
  return buildError('NETWORK', { status: 0, retryable: true });
}

export { messageFor };
