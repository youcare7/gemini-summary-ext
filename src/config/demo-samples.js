// 离线演示固定样例（生产代码，随扩展分发）。
// 与 tests/fixtures 解耦：扩展打包时不依赖 tests/ 目录。
// security 样例的 evidence 必须是 DEMO_TEXT 的真实子串，否则 result-validator 会判无效。

/** 离线演示固定输入（三模式共用，安全审查场景）。 */
export const DEMO_TEXT = [
  '【紧急】您的邮箱账户存在异常登录，为避免被永久停用，请在 24 小时内点击 ',
  'http://verify-account.example.com/login 并输入您的账号密码与短信验证码完成身份核验。',
  '客服中心',
].join('');

/** 离线演示 - 摘要结果。 */
export const DEMO_SUMMARY = {
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

/** 离线演示 - 安全审查结果。 */
export const DEMO_SECURITY = {
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

/** 离线演示 - 翻译结果（DEMO_TEXT 中译英）。 */
export const DEMO_TRANSLATE = {
  mode: 'translate',
  output:
    '[Urgent] Unusual login activity has been detected on your email account. To avoid permanent deactivation, please click http://verify-account.example.com/login within 24 hours and enter your account password and SMS verification code to complete identity verification. Customer Service Center',
  findings: [],
};

/** 离线演示固定结果（按模式取用，meta.demo=true 时展示）。 */
export const DEMO_RESULTS = Object.freeze({
  summary: DEMO_SUMMARY,
  security: DEMO_SECURITY,
  translate: DEMO_TRANSLATE,
});
