// 结果校验（Spec §9.3）：结构化输出降低格式波动，不等于事实正确。
// 客户端仍需 JSON.parse、字段类型、长度、枚举和 evidence 子串校验。

import { SEVERITIES, SECURITY_DISCLAIMER } from '../contracts/result-schema.js';

const MODES = ['summary', 'security', 'translate'];
const MAX_OUTPUT_LENGTH = 12000;
const MAX_FINDINGS = 20;
const MAX_CATEGORY_LENGTH = 200;
const MAX_EVIDENCE_LENGTH = 500;
const MAX_RECOMMENDATION_LENGTH = 1000;

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {object} [result] 校验通过的 AnalysisResult
 * @property {string} [reason] 脱敏诊断类别（不含原文与完整响应）
 */

/**
 * 校验模型返回的 AnalysisResult。
 * @param {unknown} parsed 已 JSON.parse 的模型输出
 * @param {object} ctx
 * @param {string} ctx.mode 期望的任务模式
 * @param {string} ctx.sourceText 发送给模型的原文（用于 evidence 子串校验）
 * @returns {ValidationResult}
 */
export function validateResult(parsed, { mode, sourceText }) {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'not_object' };
  }
  const { mode: gotMode, output, findings } = parsed;

  if (typeof gotMode !== 'string' || !MODES.includes(gotMode)) {
    return { ok: false, reason: 'bad_mode' };
  }
  if (gotMode !== mode) {
    return { ok: false, reason: 'mode_mismatch' };
  }
  if (typeof output !== 'string' || output.trim() === '') {
    return { ok: false, reason: 'bad_output' };
  }
  if (output.length > MAX_OUTPUT_LENGTH) {
    return { ok: false, reason: 'output_too_long' };
  }
  if (!Array.isArray(findings)) {
    return { ok: false, reason: 'bad_findings' };
  }
  if (mode !== 'security' && findings.length !== 0) {
    return { ok: false, reason: 'findings_not_empty' };
  }
  if (findings.length > MAX_FINDINGS) {
    return { ok: false, reason: 'too_many_findings' };
  }

  for (const finding of findings) {
    const bad = validateFinding(finding, sourceText);
    if (bad) return { ok: false, reason: bad };
  }

  // 免责声明不能只靠提示词约束；缺失时判失败，不替模型补写后伪装成功。
  if (mode === 'security' && !output.includes(SECURITY_DISCLAIMER)) {
    return { ok: false, reason: 'missing_security_disclaimer' };
  }

  return {
    ok: true,
    result: {
      mode: gotMode,
      output,
      findings: findings.map((f) => ({
        severity: f.severity,
        category: f.category,
        evidence: f.evidence,
        recommendation: f.recommendation,
      })),
    },
  };
}

function validateFinding(finding, sourceText) {
  if (typeof finding !== 'object' || finding === null || Array.isArray(finding)) {
    return 'finding_not_object';
  }
  const { severity, category, evidence, recommendation } = finding;
  if (typeof severity !== 'string' || !SEVERITIES.includes(severity)) {
    return 'bad_severity';
  }
  if (typeof category !== 'string' || category.trim() === '' || category.length > MAX_CATEGORY_LENGTH) {
    return 'bad_category';
  }
  if (typeof evidence !== 'string' || evidence.length > MAX_EVIDENCE_LENGTH) {
    return 'bad_evidence';
  }
  if (typeof recommendation !== 'string' || recommendation.trim() === '' || recommendation.length > MAX_RECOMMENDATION_LENGTH) {
    return 'bad_recommendation';
  }
  // 非 info 风险结论必须有可核对的原文依据；仅 info 允许空 evidence 表示信息提示。
  if (severity !== 'info' && evidence.trim() === '') {
    return 'evidence_required';
  }
  // 所有非空 evidence 必须是原文精确子串；虚构依据直接判整个结果无效。
  if (evidence !== '' && !sourceText.includes(evidence)) {
    return 'evidence_not_in_source';
  }
  return null;
}
