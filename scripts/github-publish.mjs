import { execSync } from 'node:child_process';
import https from 'node:https';

// Get token from git credential manager
const credInput = 'protocol=https\nhost=github.com\n\n';
const credOut = execSync('git credential fill', { input: credInput, encoding: 'utf8' });
const token = credOut.split('\n').find(l => l.startsWith('password='))?.slice(9);

if (!token) { console.error('No token found'); process.exit(1); }

const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'User-Agent': 'gemini-summary-ext-script'
};

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com', path, method,
      headers: { ...headers, ...(data ? {'Content-Length': Buffer.byteLength(data)} : {}) }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// T-04: Update repo metadata
console.log('=== Updating repo metadata ===');
const upd = await api('PATCH', '/repos/youcare7/gemini-summary-ext', {
  description: 'Chrome MV3 extension: right-click selected text for AI summary, security review, or translation. BYOK, session-only key storage, XSS-safe rendering.',
  has_wiki: false,
  has_projects: false,
  has_discussions: false
});
console.log('Repo:', upd.body.full_name, '-', upd.body.description);
console.log('Wiki:', upd.body.has_wiki, 'Projects:', upd.body.has_projects);

// Set topics
console.log('\n=== Setting topics ===');
const topics = ['chrome-extension', 'manifest-v3', 'gemini-api', 'byok', 'ai-summary',
  'security-review', 'translation', 'web-extension', 'llm', 'privacy-first',
  'chrome-extension-mv3', 'google-gemini', 'text-analysis', 'security-tools'];
const tr = await api('PUT', '/repos/youcare7/gemini-summary-ext/topics', { names: topics });
console.log('Topics set:', tr.body.names?.length, 'topics');

// T-03: Create release
console.log('\n=== Creating release ===');
const fs = await import('node:fs');
const releaseBody = `## 0.9.0-preview — 离线演示版

⚠️ **本版本不是 v1.0.0。**

### 状态

- ✅ 扩展加载与 UI 流程已验证（86 项自动化测试全绿）
- ✅ 三模式提示词与结果校验通过
- ✅ BYOK 会话存储与清除已验证
- ❌ **真实 API 推理未验收**（Google Cloud 项目报 403 免费层不可用）
- ❌ **默认模型 gemini-3.8-flash 未经真实推理确认**

### 安装

下载下方 ZIP，解压后在 chrome://extensions/ 开启开发者模式，点"加载已解压的扩展程序"选择解压目录。

### 离线演示

无 API Key 时可进入"离线演示"模式体验完整 UI，输出全程标注"非 Gemini API 结果"。`;

const rr = await api('POST', '/repos/youcare7/gemini-summary-ext/releases', {
  tag_name: 'v0.9.0-preview',
  name: '0.9.0-preview — 离线演示版',
  body: releaseBody,
  prerelease: true
});
console.log('Release created:', rr.body.html_url);
const releaseId = rr.body.id;

// Upload ZIP asset
console.log('\n=== Uploading ZIP asset ===');
const zipPath = 'D:/gemini-summary-ext/dist/gemini-summary-ext-0.9.0.zip';
const zipData = fs.readFileSync(zipPath);
const uploadUrl = `https://uploads.github.com/repos/youcare7/gemini-summary-ext/releases/${releaseId}/assets?name=gemini-summary-ext-0.9.0.zip`;

const uploadHeaders = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/zip',
  'Content-Length': zipData.length,
  'User-Agent': 'gemini-summary-ext-script'
};
await new Promise((resolve, reject) => {
  const up = https.request(uploadUrl, { method: 'POST', headers: uploadHeaders }, res => {
    let buf = '';
    res.on('data', c => buf += c);
    res.on('end', () => { console.log('Upload status:', res.statusCode); resolve(); });
  });
  up.on('error', reject);
  up.write(zipData);
  up.end();
});

console.log('\nDone!');
