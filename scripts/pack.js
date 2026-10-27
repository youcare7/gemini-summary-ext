// 打包脚本：产出 dist/gemini-summary-ext-<version>.zip
// 只包含 Chrome 扩展运行必需的文件，排除 node_modules/tests/docs 等。
import { createWriteStream, readdirSync, statSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const outDir = join(root, 'dist');
const outFile = join(outDir, `gemini-summary-ext-${version}.zip`);

// 必须包含的顶层文件/目录（白名单）
const INCLUDE = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'styles',
  'assets',
  'src',
];

function walk(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(base, full);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full, base));
    } else {
      files.push(rel.replace(/\\/g, '/'));
    }
  }
  return files;
}

const allFiles = walk(root);
const included = allFiles.filter(f =>
  INCLUDE.some(item => f === item || f.startsWith(item + '/'))
);

console.log(`打包 ${included.length} 个文件 -> ${basename(outFile)}`);
included.forEach(f => console.log('  ' + f));

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// 用 PowerShell Compress-Archive 打包（Windows 自带，无需第三方依赖）
const tmpList = join(root, 'dist', '.filelist.txt');
import { writeFileSync } from 'node:fs';
writeFileSync(tmpList, included.join('\n'));

// 先把文件复制到临时目录，再压缩，保证 ZIP 结构干净
const tmpDir = join(root, 'dist', '_tmp_pack');
if (existsSync(tmpDir)) {
  execSync(`rmdir /s /q "${tmpDir}"`, { shell: true });
}
mkdirSync(tmpDir, { recursive: true });

for (const f of included) {
  const src = join(root, f);
  const dst = join(tmpDir, f);
  mkdirSync(join(dst, '..'), { recursive: true });
  copyFileSync(src, dst);
}

import { copyFileSync } from 'node:fs';

execSync(`powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${outFile}' -Force"`, { stdio: 'inherit' });
execSync(`rmdir /s /q "${tmpDir}"`, { shell: true });

const size = statSync(outFile).size;
console.log(`\n完成: ${outFile} (${(size / 1024).toFixed(1)} KB)`);
if (size > 500 * 1024) {
  console.warn(`警告: ZIP 超过 500KB (${(size/1024).toFixed(0)}KB)`);
}
