// 源码卫生约束（静态断言）：生产代码不得打印日志、不得用 innerHTML 渲染动态内容。
// 对应人工冒烟 #4（Console 无报错）、#8（无选中文本被打印）、安全红线（XSS）。
// 这是"运行时行为"的静态护栏：源码层面先保证没有可打印原文的语句、没有可注入的渲染路径。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PROD_DIRS = ['src', 'background.js', 'popup.js'];

/** 递归收集生产代码 JS 文件（排除测试与依赖）。 */
function collectSources() {
  const out = [];
  const walk = (abs) => {
    const st = statSync(abs);
    if (st.isDirectory()) {
      for (const name of readdirSync(abs)) walk(join(abs, name));
      return;
    }
    if (abs.endsWith('.js')) out.push(abs);
  };
  for (const entry of PROD_DIRS) walk(join(ROOT, entry));
  return out;
}

const SOURCES = collectSources();

/** 去掉注释行，避免注释里的字样误判。 */
function codeLines(text) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    });
}

test('生产代码零 console 调用（不打印原文/Key/请求头/响应）', () => {
  const offenders = [];
  for (const file of SOURCES) {
    const lines = codeLines(readFileSync(file, 'utf8'));
    lines.forEach((line, i) => {
      if (/\bconsole\s*\.\s*(log|info|debug|warn|error|trace|dir|table)\s*\(/.test(line)) {
        offenders.push(`${relative(ROOT, file)}:${i + 1} → ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `生产代码出现 console 调用：\n${offenders.join('\n')}`);
});

test('生产代码零 innerHTML / outerHTML / insertAdjacentHTML（防 XSS）', () => {
  const offenders = [];
  for (const file of SOURCES) {
    const lines = codeLines(readFileSync(file, 'utf8'));
    lines.forEach((line, i) => {
      if (/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/.test(line)) {
        offenders.push(`${relative(ROOT, file)}:${i + 1} → ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `生产代码出现 HTML 注入路径：\n${offenders.join('\n')}`);
});

test('生产代码不 import 测试目录（保证可独立打包分发）', () => {
  const offenders = [];
  for (const file of SOURCES) {
    const text = readFileSync(file, 'utf8');
    if (/from\s+['"][^'"]*\/tests\//.test(text) || /from\s+['"]\.\.\/\.\.\/tests\//.test(text)) {
      offenders.push(relative(ROOT, file));
    }
  }
  assert.deepEqual(offenders, [], `生产代码反向依赖 tests/：${offenders.join(', ')}`);
});

test('扫描范围非空（防止护栏因路径错误而空跑）', () => {
  assert.ok(SOURCES.length >= 10, `扫描到的生产文件过少：${SOURCES.length}`);
});
