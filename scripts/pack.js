// 打包脚本：产出 dist/gemini-summary-ext-<version>.zip
// 用纯 Node 手写 ZIP，保证内部路径分隔符为 "/"（ZIP 规范 APPNOTE 4.4.17.1）。
// 不能改用 PowerShell Compress-Archive —— 它在 Windows PowerShell 5.1 下写入反斜杠，
// 导致 macOS / Linux 解压后得到名字里带反斜杠的单文件，Chrome 无法加载扩展。
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative, dirname, resolve, basename } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const outDir = join(root, 'dist');
const outFile = join(outDir, `gemini-summary-ext-${version}.zip`);

// 白名单：扩展运行必需 + 分发必须携带的许可与说明文件
const INCLUDE = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'styles',
  'assets/icons',
  'src',
  'LICENSE',
  'README.md',
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
      files.push(rel.split('\\').join('/'));
    }
  }
  return files;
}

const included = walk(root)
  .filter(f => INCLUDE.some(item => f === item || f.startsWith(item + '/')))
  .sort();

console.log(`打包 ${included.length} 个文件 -> ${basename(outFile)}`);
included.forEach(f => console.log('  ' + f));

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
if (existsSync(outFile)) rmSync(outFile, { force: true });

const now = new Date();
const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

const localParts = [];
const centralParts = [];
let offset = 0;

for (const relPath of included) {
  const data = readFileSync(join(root, relPath));
  const nameBuf = Buffer.from(relPath, 'utf8');
  const crc = crc32(data);
  let payload = deflateRawSync(data, { level: 9 });
  let method = 8;
  if (payload.length >= data.length) {
    payload = data;
    method = 0;
  }

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6);
  lh.writeUInt16LE(method, 8);
  lh.writeUInt16LE(dosTime, 10);
  lh.writeUInt16LE(dosDate, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(payload.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  lh.writeUInt16LE(0, 28);
  localParts.push(lh, nameBuf, payload);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(method, 10);
  ch.writeUInt16LE(dosTime, 12);
  ch.writeUInt16LE(dosDate, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(payload.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt16LE(0, 30);
  ch.writeUInt16LE(0, 32);
  ch.writeUInt16LE(0, 34);
  ch.writeUInt16LE(0, 36);
  ch.writeUInt32LE(0, 38);
  ch.writeUInt32LE(offset, 42);
  centralParts.push(ch, nameBuf);

  offset += lh.length + nameBuf.length + payload.length;
}

const central = Buffer.concat(centralParts);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(included.length, 8);
eocd.writeUInt16LE(included.length, 10);
eocd.writeUInt32LE(central.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

const zip = Buffer.concat([...localParts, central, eocd]);
writeFileSync(outFile, zip);

const size = statSync(outFile).size;
console.log(`\n完成: ${outFile} (${(size / 1024).toFixed(1)} KB, ${included.length} 文件)`);
if (size > 500 * 1024) {
  console.warn(`警告: ZIP 超过 500KB (${(size / 1024).toFixed(0)}KB)`);
}
