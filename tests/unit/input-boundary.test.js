// 输入边界单测：空文本、trim、10,000 字符上限（JS .length，UTF-16 code units）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInput } from '../../src/services/analysis-service.js';
import { MAX_INPUT } from '../../src/config/defaults.js';
import { INPUTS, makeLongText } from '../fixtures/inputs.js';

test('上限锁定为 10,000 字符', () => {
  assert.equal(MAX_INPUT, 10000);
});

test('空串与空白串 -> EMPTY_INPUT，本地拒绝', () => {
  for (const text of ['', '   ', '\n\t\n', INPUTS.whitespace, null, undefined, 123]) {
    const r = checkInput(text);
    assert.equal(r.ok, false, `应拒绝：${String(text)}`);
    assert.equal(r.kind, 'EMPTY_INPUT');
    assert.equal(r.error.kind, 'EMPTY_INPUT');
    assert.match(r.error.message, /选中文本为空/);
  }
});

test('trim 后判断：带空白的短文本可提交，长度按 trim 计', () => {
  const r = checkInput(`  ${INPUTS.translateEn}  \n`);
  assert.equal(r.ok, true);
  assert.equal(r.text, INPUTS.translateEn);
  assert.equal(r.length, INPUTS.translateEn.length);
});

test('恰好 10,000 字符可提交（等于上限）', () => {
  const r = checkInput(makeLongText(MAX_INPUT));
  assert.equal(r.ok, true);
  assert.equal(r.length, MAX_INPUT);
});

test('10,001 字符本地拒绝 INPUT_TOO_LONG，不静默截断', () => {
  const r = checkInput(makeLongText(MAX_INPUT + 1));
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'INPUT_TOO_LONG');
  assert.match(r.error.message, /10,001/);
  assert.match(r.error.message, /10,000 字上限/);
  assert.match(r.error.message, /缩短选区/);
});

test('trim 后超限才拒绝：前缀空白不占计数', () => {
  const text = `   ${makeLongText(MAX_INPUT)}`;
  assert.equal(text.length, MAX_INPUT + 3);
  const r = checkInput(text);
  assert.equal(r.ok, true);
  assert.equal(r.length, MAX_INPUT);
});

test('UTF-16 code units 计数：emoji 算 2 个单位', () => {
  const emoji = '😀'; // length === 2
  assert.equal(emoji.length, 2);
  const text = emoji.repeat(MAX_INPUT / 2); // 正好 10000
  assert.equal(checkInput(text).ok, true);
  assert.equal(checkInput(`${text}${emoji}`).ok, false);
});

test('换行与 Unicode 正常通过', () => {
  const text = '第一行\n第二行\t制表符。Ünïcödé 混排 ABC_123。';
  const r = checkInput(text);
  assert.equal(r.ok, true);
  assert.equal(r.text, text);
});
