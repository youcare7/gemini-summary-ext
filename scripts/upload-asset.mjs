import { execSync } from 'node:child_process';
import https from 'node:https';

const credInput = 'protocol=https\nhost=github.com\n\n';
const credOut = execSync('git credential fill', { input: credInput, encoding: 'utf8' });
const token = credOut.split('\n').find(l => l.startsWith('password='))?.slice(9);

const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'gemini-summary-ext-script'
};

function api(method, path, body, rawUrl) {
  return new Promise((resolve, reject) => {
    const url = rawUrl ? new URL(rawUrl) : { hostname: 'api.github.com', path };
    const data = body ? JSON.stringify(body) : null;
    const h = { ...headers };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const req = https.request({ hostname: url.hostname, path: url.pathname, method, headers: h }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// List releases
const releases = await api('GET', '/repos/youcare7/gemini-summary-ext/releases');
console.log('Releases:', releases.body.length);
for (const r of releases.body) {
  console.log(`  ${r.tag_name} (id=${r.id}, prerelease=${r.prerelease}, assets=${r.assets.length})`);
}

// Get the release
const release = releases.body[0];
if (!release) { console.log('No release found'); process.exit(1); }

// Upload asset
const fs = await import('node:fs');
const zipData = fs.readFileSync('D:/gemini-summary-ext/dist/gemini-summary-ext-0.9.0.zip');
console.log(`\nZIP size: ${zipData.length} bytes`);

const uploadUrl = `https://uploads.github.com/repos/youcare7/gemini-summary-ext/releases/${release.id}/assets?name=gemini-summary-ext-0.9.0.zip`;
console.log('Uploading to:', uploadUrl);

const upHeaders = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/zip',
  'Content-Length': zipData.length,
  'User-Agent': 'gemini-summary-ext-script'
};

await new Promise((resolve, reject) => {
  const u = new URL(uploadUrl);
  const up = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: upHeaders }, res => {
    let buf = '';
    res.on('data', c => buf += c);
    res.on('end', () => {
      console.log('Upload status:', res.statusCode);
      console.log('Response:', buf.slice(0, 500));
      resolve();
    });
  });
  up.on('error', reject);
  up.write(zipData);
  up.end();
});
