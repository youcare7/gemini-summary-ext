// result-validator 单测：字段类型/长度/枚举/evidence 原文子串校验（node:test）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateResult } from '../../src/services/result-validator.js';
import { INPUTS } from '../fixtures/inputs.js';
import { validSummary, validSecurity, invalidResults, xssOutput, insufficientSummary } from '../fixtures/outputs.js';
import { DEMO_RESULTS, DEMO_TEXT } from '../../src/config/demo-samples.js';

const SOURCE = INPUTS.securityPhishing;

test('摘要合法结果通过，且 findings 必须为空', () => {
  const r = validateResult(validSummary, { mode: 'summary', sourceText: INPUTS.summaryZh });
  assert.equal(r.ok, true);
  assert.equal(r.result.findings.length, 0);
});

test('摘要带 findings 判无效', () => {
  const r = validateResult(invalidResults.summaryWithFindings, { mode: 'summary', sourceText: INPUTS.summaryZh });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'findings_not_empty');
});

test('安全审查合法结果通过（evidence 为原文子串）', () => {
  const r = validateResult(validSecurity, { mode: 'security', sourceText: SOURCE });
  assert.equal(r.ok, true);
  assert.equal(r.result.findings.length, 3);
});

test('伪造 evidence（非原文子串）判整个结果无效', () => {
  const r = validateResult(invalidResults.forgedEvidence, { mode: 'security', sourceText: SOURCE });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'evidence_not_in_source');
});

test('evidence 为空字符串表示无原文依据，允许', () => {
  const result = {
    mode: 'security',
    output: '无法判断。基于所选文本的辅助判断，不构成安全保证。',
    findings: [{ severity: 'info', category: '信息不足', evidence: '', recommendation: '建议补充上下文。' }],
  };
  const r = validateResult(result, { mode: 'security', sourceText: SOURCE });
  assert.equal(r.ok, true);
});

test('缺字段判无效', () => {
  const r = validateResult(invalidResults.missingFields, { mode: 'security', sourceText: SOURCE });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad_findings');
});

test('severity 枚举非法判无效', () => {
  const r = validateResult(invalidResults.badSeverity, { mode: 'security', sourceText: SOURCE });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad_severity');
});

test('mode 与期望不一致判无效', () => {
  const r = validateResult(invalidResults.modeMismatch, { mode: 'security', sourceText: SOURCE });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'mode_mismatch');
});

test('output 为空白判无效', () => {
  const r = validateResult(invalidResults.emptyOutput, { mode: 'summary', sourceText: INPUTS.summaryZh });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad_output');
});

test('非对象判无效', () => {
  for (const bad of [null, 'x', 42, ['summary'], invalidResults.notObject]) {
    const r = validateResult(bad, { mode: 'summary', sourceText: INPUTS.summaryZh });
    assert.equal(r.ok, false);
  }
});

test('含 HTML 的输出仅按数据校验通过（渲染层负责纯文本展示）', () => {
  const r = validateResult(xssOutput, { mode: 'summary', sourceText: INPUTS.xssText });
  assert.equal(r.ok, true);
  assert.ok(r.result.output.includes('<img'));
});

test('findings 数量上限保护', () => {
  const findings = Array.from({ length: 21 }, () => ({
    severity: 'info',
    category: 'x',
    evidence: '',
    recommendation: 'y',
  }));
  const r = validateResult({ mode: 'security', output: 'x', findings }, { mode: 'security', sourceText: SOURCE });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'too_many_findings');
});

// AC-05：信息不足不补造 —— 消费 insufficientSummary fixture（此前该 fixture 未被任何测试使用）。
test('AC-05：信息不足的摘要结果合法通过，且不补造内容', () => {
  const r = validateResult(insufficientSummary, { mode: 'summary', sourceText: '短句。' });
  assert.equal(r.ok, true);
  assert.equal(r.result.mode, 'summary');
  assert.equal(r.result.findings.length, 0);
  assert.match(r.result.output, /信息不足，无法形成可靠摘要/);
});

// 离线演示样例随扩展分发，必须能通过同一套校验器（否则演示会显示"结果无法识别"）。
test('离线演示三模式样例均通过校验（security evidence 必须是原文子串）', () => {
  for (const mode of ['summary', 'security', 'translate']) {
    const sample = DEMO_RESULTS[mode];
    const sourceText = mode === 'translate' ? DEMO_TEXT : DEMO_TEXT;
    const r = validateResult(sample, { mode, sourceText });
    assert.equal(r.ok, true, `离线演示 ${mode} 样例校验失败：${r.reason}`);
  }
});

test('离线演示样例与 DEMO_TEXT 的 evidence 一致性', () => {
  for (const finding of DEMO_RESULTS.security.findings) {
    if (finding.evidence === '') continue;
    assert.ok(
      DEMO_TEXT.includes(finding.evidence),
      `evidence 不是 DEMO_TEXT 子串：${finding.evidence}`,
    );
  }
});
