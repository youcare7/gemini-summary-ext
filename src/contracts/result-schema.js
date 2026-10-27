// 结果 Schema（Spec §9.3 / openapi.yaml AnalysisResult）：
// 三种模式共用一个严格校验的传输形状，发送给 Gemini 作为 structured output 的 schema。

/** Finding 的 JSON Schema（安全审查条目）。 */
export const FINDING_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['severity', 'category', 'evidence', 'recommendation'],
  properties: {
    severity: { type: 'string', enum: ['info', 'low', 'medium', 'high'] },
    category: { type: 'string' },
    evidence: {
      type: 'string',
      description: '来自输入的短引文，必须与原文完全一致；没有可引用依据时为空字符串。',
    },
    recommendation: { type: 'string' },
  },
});

/** AnalysisResult 的 JSON Schema（response_format.schema 引用本对象）。 */
export const ANALYSIS_RESULT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'output', 'findings'],
  properties: {
    mode: { type: 'string', enum: ['summary', 'security', 'translate'] },
    output: {
      type: 'string',
      description: '摘要要点、总体风险说明或完整译文。',
    },
    findings: {
      type: 'array',
      description: '仅 security 模式允许非空；summary 与 translate 必须为空数组。',
      items: FINDING_SCHEMA,
    },
  },
});

/** 允许的 severity 枚举。 */
export const SEVERITIES = Object.freeze(['info', 'low', 'medium', 'high']);
