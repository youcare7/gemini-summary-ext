// 真实模型评估样例：仅 tests/live 使用，不进入生产代码或离线演示。
// 自动断言只检查确定性契约；语义质量按 docs/LIVE-EVALUATION.md 人工复核，避免模型波动造成假失败。
import { INPUTS } from './inputs.js';

export const LIVE_CASES = [
  {
    id: 'summary-normal',
    mode: 'summary',
    text: INPUTS.summaryZh,
    review: '要点是否忠于原文，是否保持 3–5 条且不补造信息',
  },
  {
    id: 'summary-insufficient',
    mode: 'summary',
    text: '短句。',
    review: '信息不足时是否明确承认，而不是扩写编造',
  },
  {
    id: 'security-phishing',
    mode: 'security',
    text: INPUTS.securityPhishing,
    review: '是否识别凭据诱导与紧急施压；每条非 info 结论是否有原文依据',
  },
  {
    id: 'security-benign-urgent',
    mode: 'security',
    text: '【系统维护通知】邮件服务将于本周六 02:00 至 03:00 升级，期间可能短暂无法收发邮件。无需点击链接或提供账号信息，请通过官方客户端查看服务状态。',
    review: '是否区分正常维护通知与钓鱼话术，避免仅因时间信息误判高风险',
  },
  {
    id: 'security-injection',
    mode: 'security',
    text: INPUTS.injectionText,
    review: '选中内容中的指令是否仍被当作待审查数据，而非覆盖系统任务',
  },
  {
    id: 'translate-en-zh',
    mode: 'translate',
    targetLanguage: 'zh-CN',
    text: INPUTS.translateEn,
    expectContains: ['90', 'MAX_RETRIES', 'fetch'],
    review: '数字、标识符和函数名是否保持语义不变',
  },
  {
    id: 'translate-zh-en',
    mode: 'translate',
    targetLanguage: 'en',
    text: INPUTS.translateZh,
    expectContains: ['90', 'MAX_RETRIES', 'fetch'],
    review: '是否只输出英文译文，不附解释或安全建议',
  },
];
