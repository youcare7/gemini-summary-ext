// 图标生成脚本（手动运行，不属于 E2E 套件，文件名不含 .spec 故不会被自动收集）。
// 运行：node scripts/gen-icons.mjs
//
// 用 Playwright 的 Chromium 渲染 HTML/SVG 后截图，保证 Lucide 路径几何 100% 保真。
// 两套画法分别渲染，不做位图缩放：
//   16 / 32 / 48 → simple：3 条白色圆角横条（16 网格），占画布 62%
//   128          → full  ：assets/icons/file-text.svg 原样渲染（Lucide 24 网格描边），占画布 58%
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const iconsDir = path.resolve('assets/icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// 主色取 styles/popup.css 的 --accent 原值；圆角 = 边长 22%
const ACCENT = 'oklch(54% 0.2 264)';
const RADIUS_PCT = 22;

const fileTextSvg = fs.readFileSync(path.join(iconsDir, 'file-text.svg'), 'utf8');

// simple 画法：16 网格内三条横条，组外接框为 x 4.5~11.5 / y 4~12（7 × 8）
function simpleGlyph(size) {
  const h = size * 0.62; // 组高度占画布 62%
  const w = (h * 7) / 8; // 保持 7:8 比例
  return `<svg width="${w}" height="${h}" viewBox="4.5 4 7 8" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect x="4.5" y="4" width="7" height="2" rx="1" fill="#fff" />
      <rect x="4.5" y="7" width="7" height="2" rx="1" fill="#fff" />
      <rect x="4.5" y="10" width="4.5" height="2" rx="1" fill="#fff" />
    </svg>`;
}

// full 画法：Lucide file-text 原样传入，容器 58%，靠 CSS 撑满并居中对齐
function fullGlyph() {
  return fileTextSvg;
}

function buildHtml(size, glyph, glyphPct, glyphClass = '') {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .canvas {
    position: relative;
    width: ${size}px;
    height: ${size}px;
    display: grid;
    place-items: center;
  }
  .bg {
    position: absolute;
    inset: 0;
    border-radius: ${RADIUS_PCT}%;
    background: ${ACCENT};
  }
  .glyph {
    position: relative;
    width: ${glyphPct}%;
    height: ${glyphPct}%;
    display: grid;
    place-items: center;
    color: #fff;
  }
  .glyph > svg { display: block; max-width: 100%; max-height: 100%; }
  /* full 画法：Lucide 源 SVG 自带 24×24 属性，需强制撑满容器 */
  .glyph--full > svg { width: 100%; height: 100%; }
</style>
</head>
<body>
  <div class="canvas">
    <div class="bg"></div>
    <div class="glyph ${glyphClass}">${glyph}</div>
  </div>
</body>
</html>`;
}

const PLAN = [
  { size: 16, variant: 'simple' },
  { size: 32, variant: 'simple' },
  { size: 48, variant: 'simple' },
  { size: 128, variant: 'full' },
];

const browser = await chromium.launch();
try {
  for (const { size, variant } of PLAN) {
    const context = await browser.newContext({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    // 16/32/48 的横条已在 simpleGlyph 内按像素算好，容器给满即可。
    // 128 的 Lucide 源图形墨迹为 16×20 / 24×24，容器需放大到 58% × 24/20 ≈ 69.6%，
    // 才能让墨迹本身占画布 58%，与三个小尺寸的 62% 视觉占比保持一致。
    const glyphPct = variant === 'simple' ? 100 : (58 * 24) / 20;
    const glyph = variant === 'simple' ? simpleGlyph(size) : fullGlyph();
    const glyphClass = variant === 'full' ? 'glyph--full' : '';
    await page.setContent(buildHtml(size, glyph, glyphPct, glyphClass), { waitUntil: 'load' });
    const out = path.join(iconsDir, `icon-${size}.png`);
    await page.screenshot({ path: out, omitBackground: true });
    const bytes = fs.statSync(out).size;
    console.log(`icon-${size}.png  ${variant}  ${bytes} bytes`);
    await context.close();
  }
} finally {
  await browser.close();
}
