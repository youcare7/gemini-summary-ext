// 分析服务（应用层）：组合 prompt -> client -> validate，产出统一结果/错误载荷。
// 纯业务编排，不触碰 chrome API 与 DOM；网络层可注入以便测试。

import { MAX_INPUT, DEFAULT_MODEL } from '../config/defaults.js';
import { buildRequestBody } from './prompt-builder.js';
import { validateResult } from './result-validator.js';
import { buildError, normalizeError } from './error-mapping.js';
import { callInteractions, extractModelText } from '../infrastructure/gemini-client.js';

/**
 * 输入边界校验（Spec §10：trim 后判断；等于 10000 可提交，超过本地拒绝；空本地拒绝）。
 * @param {string} text
 * @returns {{ok:true, text:string, length:number} | {ok:false, kind:string, error:object, length:number}}
 */
export function checkInput(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  const length = trimmed.length;
  if (length === 0) {
    return { ok: false, kind: 'EMPTY_INPUT', length, error: buildError('EMPTY_INPUT') };
  }
  if (length > MAX_INPUT) {
    return {
      ok: false,
      kind: 'INPUT_TOO_LONG',
      length,
      error: buildError('INPUT_TOO_LONG', {
        message: `已选 ${length.toLocaleString('en-US')} 字，超过 ${MAX_INPUT.toLocaleString('en-US')} 字上限。请缩短选区后重试。`,
      }),
    };
  }
  return { ok: true, text: trimmed, length };
}

/**
 * 执行一次分析。
 * @param {object} opts
 * @param {string} opts.text 原始选中文本（内部 trim 后使用）
 * @param {'summary'|'security'|'translate'} opts.mode
 * @param {'auto'|'zh-CN'|'en'} [opts.targetLanguage]
 * @param {string|null} opts.apiKey 会话 Key；null 表示未配置
 * @param {string} [opts.model]
 * @param {AbortSignal} [opts.signal]
 * @param {typeof fetch} [opts.fetchFn] 测试注入
 * @param {(ms:number)=>Promise<void>} [opts.sleepFn] 测试注入
 * @param {()=>number} [opts.randomFn] 测试注入
 * @returns {Promise<{ok:true,result:object}|{ok:false,error:object}>}
 */
export async function analyze({
  text,
  mode,
  targetLanguage = 'auto',
  apiKey,
  model = DEFAULT_MODEL,
  signal,
  fetchFn,
  sleepFn,
  randomFn,
}) {
  const inputCheck = checkInput(text);
  if (!inputCheck.ok) return { ok: false, error: inputCheck.error };

  if (!apiKey) {
    return { ok: false, error: buildError('MISSING_KEY') };
  }

  const body = buildRequestBody({ text: inputCheck.text, mode, targetLanguage, model });

  let interaction;
  try {
    interaction = await callInteractions({
      apiKey,
      body,
      signal,
      fetchFn,
      sleepFn,
      randomFn,
    });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }

  const rawText = extractModelText(interaction);
  if (rawText === null) {
    return { ok: false, error: buildError('MALFORMED_RESPONSE') };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: buildError('MALFORMED_RESPONSE') };
  }

  const validation = validateResult(parsed, { mode, sourceText: inputCheck.text });
  if (!validation.ok) {
    // 只回传脱敏诊断类别，不回传模型原文
    return {
      ok: false,
      error: buildError('MALFORMED_RESPONSE', {
        message: `服务返回的内容无法识别（诊断：${validation.reason}）。下一步：重试；若持续出现请保留该诊断类别。`,
      }),
    };
  }

  return { ok: true, result: validation.result };
}
