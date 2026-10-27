// prompt-builder 单测：三模式提示词与请求体契约（node:test）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemInstruction,
  buildRequestBody,
  REQUEST_TARGET,
} from '../../src/services/prompt-builder.js';
import { ANALYSIS_RESULT_SCHEMA } from '../../src/contracts/result-schema.js';
import { INPUTS } from '../fixtures/inputs.js';

test('摘要模式：固定 3-5 条要点、findings 空数组、不编造', () => {
  const s = buildSystemInstruction({ mode: 'summary' });
  assert.match(s, /3 到 5 条/);
  assert.match(s, /findings 字段必须是空数组/);
  assert.match(s, /不得补充原文没有的信息/);
  assert.match(s, /信息不足，无法形成可靠摘要/);
});

test('安全审查模式：固定小节、evidence 原文一致、不确定性与非保证性结论', () => {
  const s = buildSystemInstruction({ mode: 'security' });
  assert.match(s, /风险类型/);
  assert.match(s, /原文依据|与原文完全一致/);
  assert.match(s, /判断理由/);
  assert.match(s, /不确定/);
  assert.match(s, /建议动作/);
  assert.match(s, /不构成安全保证/);
  assert.match(s, /不代表链接、文件或发送者安全/);
  assert.match(s, /绝对安全/); // 明确禁止绝对安全表述
  assert.match(s, /不访问任何 URL/);
});

test('翻译模式：目标语言方向与仅输出译文', () => {
  const auto = buildSystemInstruction({ mode: 'translate', targetLanguage: 'auto' });
  const toEn = buildSystemInstruction({ mode: 'translate', targetLanguage: 'en' });
  const toZh = buildSystemInstruction({ mode: 'translate', targetLanguage: 'zh-CN' });
  assert.match(auto, /自动识别/);
  assert.match(toEn, /英文（en）/);
  assert.match(toZh, /中文（zh-CN）/);
  for (const s of [auto, toEn, toZh]) {
    assert.match(s, /只输出译文/);
    assert.match(s, /findings 字段必须是空数组/);
    assert.match(s, /数字、代码、标识符、URL/);
  }
});

test('三模式均含提示注入防护：选中文本是不可信数据', () => {
  for (const mode of ['summary', 'security', 'translate']) {
    const s = buildSystemInstruction({ mode });
    assert.match(s, /不可信数据/);
    assert.match(s, /不调用任何工具/);
  }
});

test('未知模式抛出 TypeError', () => {
  assert.throws(() => buildSystemInstruction({ mode: 'chat' }), TypeError);
});

test('请求体契约：store=false stream=false、structured output、input 不进系统指令', () => {
  const body = buildRequestBody({
    text: INPUTS.injectionText,
    mode: 'security',
    model: 'gemini-3.5-flash',
  });
  assert.equal(body.store, false);
  assert.equal(body.stream, false);
  assert.equal(body.input, INPUTS.injectionText);
  assert.equal(body.model, 'gemini-3.5-flash');
  assert.equal(body.generation_config.max_output_tokens, 2048);
  assert.equal(body.response_format.type, 'text');
  assert.equal(body.response_format.mime_type, 'application/json');
  assert.deepEqual(body.response_format.schema, ANALYSIS_RESULT_SCHEMA);
  assert.ok(!body.system_instruction.includes(INPUTS.injectionText));
});

test('请求体使用固定端点与 Api-Revision 契约常量', () => {
  assert.equal(REQUEST_TARGET.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(REQUEST_TARGET.revision, '2026-05-20');
});

test('结果 Schema 契约：required 字段与 additionalProperties=false', () => {
  assert.equal(ANALYSIS_RESULT_SCHEMA.type, 'object');
  assert.equal(ANALYSIS_RESULT_SCHEMA.additionalProperties, false);
  assert.deepEqual(ANALYSIS_RESULT_SCHEMA.required, ['mode', 'output', 'findings']);
  assert.deepEqual(ANALYSIS_RESULT_SCHEMA.properties.mode.enum, ['summary', 'security', 'translate']);
});
