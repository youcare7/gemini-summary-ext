// 全局默认值与限制（Spec §8/§10 锁定值）。
// 模型候选仅为文档依据的候选值，未经真实推理验证（OPEN-002）。

/** 默认任务模式。 */
export const DEFAULT_MODE = 'summary';

/** 翻译方向默认值：自动识别。 */
export const DEFAULT_TARGET_LANGUAGE = 'auto';

/**
 * 模型候选列表。
 * gemini-3.8-flash 依据 2026-10-26 官方文档示例选出（ai.google.dev/gemini-api/docs），
 * 但未经本项目真实推理验证（OPEN-002）。
 * 不自动切换到其他模型，尤其不静默切到付费模型。
 */
export const MODEL_CANDIDATES = Object.freeze(['gemini-3.8-flash']);

/** 默认模型（未验证候选，见 MODEL_CANDIDATES 注释）。 */
export const DEFAULT_MODEL = MODEL_CANDIDATES[0];

/** 输入上限：JS .length（UTF-16 code units），trim 后判断；等于可提交，超过本地拒绝。 */
export const MAX_INPUT = 10000;

/** 单次请求超时（毫秒）。 */
export const TIMEOUT_MS = 30000;

/** 429/5xx/网络错误的最大自动重试次数。 */
export const MAX_RETRIES = 2;

/** 重试退避基数（毫秒）。 */
export const RETRY_BASE_MS = 1000;

/** 重试退避上限（毫秒）。 */
export const RETRY_MAX_MS = 8000;

/** 单个任务总时间预算（毫秒），包含重试与退避。 */
export const TOTAL_BUDGET_MS = 90000;

/** Gemini Interactions API 端点。 */
export const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** API 修订号（2026-05-20 后 steps 架构）。官方注明 2026-06-08 后此头被忽略（新 schema 已默认），保留无害。 */
export const API_REVISION = '2026-05-20';

/** 单次生成的最大输出 token 数。 */
export const MAX_OUTPUT_TOKENS = 2048;

/** 允许的模式枚举。 */
export const MODES = Object.freeze(['summary', 'security', 'translate']);

/** 允许的翻译方向枚举（auto = 自动识别源语言并互译）。 */
export const TARGET_LANGUAGES = Object.freeze(['auto', 'zh-CN', 'en']);
