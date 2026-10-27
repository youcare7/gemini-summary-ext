// 固定输出样例（单测、E2E 共用）。
// security 的 evidence 均为 INPUTS.securityPhishing 的真实子串。
// 离线演示样例的唯一真源在 src/config/demo-samples.js（随扩展分发），此处 re-export 供测试使用。

import { INPUTS } from './inputs.js';

/** 摘要模式合法结果。 */
export const validSummary = {
  mode: 'summary',
  output: [
    '- 缓存穿透指查询数据库中必然不存在的数据，请求会绕过缓存直接打到数据库。',
    '- 常见防护有缓存空对象、布隆过滤器与单 IP 限流三种方式。',
    '- 三种方式可组合使用：布隆过滤器适合键空间大且容忍极小误判率的场景。',
    '- 缓存空对象实现最简单，但会占用额外内存。',
    '- 方案选择需结合业务读写比例与数据更新频率。',
  ].join('\n'),
  findings: [],
};

/** 安全审查模式合法结果（evidence 为 DEMO_TEXT 真实子串）。 */
export const validSecurity = {
  mode: 'security',
  output:
    '该文本呈现典型的账号核验诱导话术，存在较高风险。由于仅基于所选文本，无法核实链接实际指向、发送者身份与真实业务背景，判断存在不确定性。基于所选文本的辅助判断，不构成安全保证。',
  findings: [
    {
      severity: 'high',
      category: '凭据诱导（钓鱼话术）',
      evidence: '输入您的账号密码与短信验证码完成身份核验',
      recommendation:
        '理由：正规服务通常不会在邮件中直接索要账号密码与短信验证码。建议动作：不要在该页面输入任何凭据，通过官方客户端或书签入口自行登录核实。',
    },
    {
      severity: 'high',
      category: '制造紧急与威胁',
      evidence: '请在 24 小时内点击',
      recommendation:
        '理由：以"永久停用"威胁并限定短时间窗口，是典型的施压话术。建议动作：忽略时限压力，先通过官方渠道核实账户状态。',
    },
    {
      severity: 'medium',
      category: '可疑链接话术',
      evidence: 'http://verify-account.example.com/login',
      recommendation:
        '理由：链接域名与声称的"客服中心"不一致，且使用明文 HTTP。建议动作：不要点击该链接；如需核实，请手动输入官方域名访问。',
    },
  ],
};

/** 翻译模式合法结果（英译中）。 */
export const validTranslateEnToZh = {
  mode: 'translate',
  output: '重试总预算为 90 秒。将 MAX_RETRIES 设为 2，然后再次调用 fetch()。',
  findings: [],
};

/** 翻译模式合法结果（中译英）。 */
export const validTranslateZhToEn = {
  mode: 'translate',
  output: 'The total retry budget is 90 seconds. Set MAX_RETRIES to 2 and call fetch() again.',
  findings: [],
};

/** 输出含 HTML/脚本的合法结果（用于 XSS 纯文本渲染验证）。 */
export const xssOutput = {
  mode: 'summary',
  output: `${INPUTS.xssText}\n- 第二条要点 <b>加粗</b>`,
  findings: [],
};

/** 信息不足的合法结果（摘要）。 */
export const insufficientSummary = {
  mode: 'summary',
  output: '选中文本信息不足，无法形成可靠摘要。',
  findings: [],
};

/** 非法结果集合（用于 result-validator 单测与 Mock 响应）。 */
export const invalidResults = {
  /** summary 模式却带 findings */
  summaryWithFindings: {
    mode: 'summary',
    output: '- 要点',
    findings: [
      { severity: 'info', category: 'x', evidence: '', recommendation: 'y' },
    ],
  },
  /** 伪造 evidence（不是原文子串） */
  forgedEvidence: {
    mode: 'security',
    output: '存在风险。基于所选文本的辅助判断，不构成安全保证。',
    findings: [
      {
        severity: 'high',
        category: '凭据诱导',
        evidence: '这段引文从未出现在原文中',
        recommendation: '理由：伪造。建议：无。',
      },
    ],
  },
  /** 缺字段 */
  missingFields: { mode: 'security', output: 'x' },
  /** 枚举非法 */
  badSeverity: {
    mode: 'security',
    output: 'x',
    findings: [
      { severity: 'critical', category: 'y', evidence: '', recommendation: 'z' },
    ],
  },
  /** 模式不匹配 */
  modeMismatch: { mode: 'summary', output: 'x', findings: [] },
  /** output 为空 */
  emptyOutput: { mode: 'summary', output: '   ', findings: [] },
  /** 非对象 */
  notObject: ['summary'],
};

/** 把模型文本包装成 Interactions API 响应（steps -> model_output -> content -> text）。 */
export function wrapInteraction(modelText, { status = 'completed' } = {}) {
  return {
    id: 'interaction-test',
    model: 'gemini-3.5-flash',
    status,
    steps: [
      {
        type: 'user_input',
        content: [{ type: 'text', text: 'redacted' }],
      },
      {
        type: 'model_output',
        content: [{ type: 'text', text: modelText }],
      },
    ],
  };
}

/** 把结果对象序列化为模型文本并包装成响应。 */
export function wrapResult(result, opts) {
  return wrapInteraction(JSON.stringify(result), opts);
}

/** 离线演示固定结果（唯一真源在 src/config/demo-samples.js，随扩展分发）。 */
export { DEMO_RESULTS, DEMO_TEXT } from '../../src/config/demo-samples.js';
