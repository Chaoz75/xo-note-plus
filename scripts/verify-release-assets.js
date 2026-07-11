// Sometimes GitHub (or a flaky upload) drops one or two files from a release
// instead of splitting it into a duplicate — e.g. v1.2.2 went live with only
// the .blockmap and neither the actual installer .exe nor latest.yml, which
// silently breaks auto-update for that version (electron-updater can't find
// latest.yml at all). merge-split-release.js only handles the "two releases,
// same tag" case; this script handles "one release, missing files" by
// re-uploading whatever's missing straight from the local dist/ build.
//
// Notably: if latest.yml is missing, this does NOT trust whatever latest.yml
// happens to be sitting in dist/ (electron-builder doesn't always regenerate
// it on every build, so it can be stale from a previous version) — it hashes
// the actual local .exe fresh and writes a brand-new, correct latest.yml.
//
// Runs automatically at the end of PUBLISH-UPDATE.bat. Safe to run by hand
// too: `node scripts\verify-release-assets.js`.

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');

const pkg = require('../package.json');
const GH_TOKEN = process.env.GH_TOKEN || '';
const publishCfg = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
const OWNER = publishCfg.owner || '';
const REPO = publishCfg.repo || '';
const VERSION = pkg.version;
const TAG = 'v' + VERSION;
const DIST_DIR = path.join(__dirname, '..', (pkg.build && pkg.build.directories && pkg.build.directories.output) || 'dist');

function skip(msg) {
  console.log('[verify-release-assets] ' + msg);
  process.exit(0); // never fail the publish batch over this — it's a safety-net cleanup step
}

if (!GH_TOKEN) skip('GH_TOKEN is not set in this window, skipping.');
if (!OWNER || !REPO) skip('Could not read owner/repo from package.json build.publish config.');

function ghApi(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: urlPath,
      method: method,
      headers: Object.assign({
        'Authorization': 'token ' + GH_TOKEN,
        'User-Agent': 'xo-note-plus-publish-script',
        'Accept': 'application/vnd.github+json'
      }, payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(data ? JSON.parse(data) : null); } catch (e) { resolve(null); }
        } else {
          reject(new Error(method + ' ' + urlPath + ' -> ' + res.statusCode + ' ' + data));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function contentTypeFor(name) {
  if (name.toLowerCase().endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (name.toLowerCase().endsWith('.yml') || name.toLowerCase().endsWith('.yaml')) return 'text/yaml';
  return 'application/octet-stream';
}

function uploadAsset(releaseId, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const req = https.request({
      hostname: 'uploads.github.com',
      path: '/repos/' + OWNER + '/' + REPO + '/releases/' + releaseId + '/assets?name=' + encodeURIComponent(fileName),
      method: 'POST',
      headers: {
        'Authorization': 'token ' + GH_TOKEN,
        'User-Agent': 'xo-note-plus-publish-script',
        'Content-Type': contentTypeFor(fileName),
        'Content-Length': stat.size
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error('Upload failed: ' + res.statusCode + ' ' + data));
      });
    });
    req.on('error', reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

function sha512Base64(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('base64')));
    stream.on('error', reject);
  });
}

async function main() {
  console.log('[verify-release-assets] Checking that ' + TAG + ' has all 3 expected files (installer, blockmap, latest.yml)...');
  const releases = await ghApi('GET', '/repos/' + OWNER + '/' + REPO + '/releases?per_page=30');
  const release = (releases || []).find((r) => r.tag_name === TAG);
  if (!release) skip('No release tagged ' + TAG + ' found yet — nothing to verify.');

  const assetNames = new Set((release.assets || []).map((a) => a.name));
  // electron-builder's GitHub uploads use the package "name" field (not the
  // display productName) in the asset filename — confirmed empirically from
  // existing releases, e.g. "xo-note-plus-setup-1.2.2.exe".
  const exeAssetName = pkg.name + '-setup-' + VERSION + '.exe';
  const blockmapAssetName = exeAssetName + '.blockmap';

  if (!fs.existsSync(DIST_DIR)) skip('dist/ folder not found at ' + DIST_DIR + ' — nothing local to upload from.');
  const distFiles = fs.readdirSync(DIST_DIR);
  const localExe = distFiles.find((f) => f.toLowerCase().endsWith('.exe') && f.indexOf(VERSION) !== -1);
  const localBlockmap = distFiles.find((f) => f.toLowerCase().endsWith('.exe.blockmap') && f.indexOf(VERSION) !== -1);

  let fixedAnything = false;

  if (!assetNames.has(exeAssetName)) {
    if (!localExe) skip('Missing ' + exeAssetName + ' on GitHub, and no matching local .exe in dist/ to upload — build ' + VERSION + ' first.');
    console.log('[verify-release-assets] Missing ' + exeAssetName + ' — uploading from dist/' + localExe + '...');
    await uploadAsset(release.id, path.join(DIST_DIR, localExe), exeAssetName);
    fixedAnything = true;
  }

  if (!assetNames.has(blockmapAssetName) && localBlockmap) {
    console.log('[verify-release-assets] Missing ' + blockmapAssetName + ' — uploading from dist/' + localBlockmap + '...');
    await uploadAsset(release.id, path.join(DIST_DIR, localBlockmap), blockmapAssetName);
    fixedAnything = true;
  }

  if (!assetNames.has('latest.yml')) {
    if (!localExe) skip('Missing latest.yml on GitHub, and no local .exe available to hash — build ' + VERSION + ' first.');
    console.log('[verify-release-assets] Missing latest.yml — hashing the real installer fresh (not trusting any stale copy in dist/) and generating a correct one...');
    const exePath = path.join(DIST_DIR, localExe);
    const stat = fs.statSync(exePath);
    const hash = await sha512Base64(exePath);
    const ymlContent =
      'version: ' + VERSION + '\n' +
      'files:\n' +
      '  - url: ' + exeAssetName + '\n' +
      '    sha512: ' + hash + '\n' +
      '    size: ' + stat.size + '\n' +
      'path: ' + exeAssetName + '\n' +
      'sha512: ' + hash + '\n' +
      "releaseDate: '" + new Date().toISOString() + "'\n";
    const tmpFile = path.join(os.tmpdir(), 'latest-' + VERSION + '.yml');
    fs.writeFileSync(tmpFile, ymlContent, 'utf8');
    await uploadAsset(release.id, tmpFile, 'latest.yml');
    fs.unlinkSync(tmpFile);
    fixedAnything = true;
  }

  if (!fixedAnything) {
    console.log('[verify-release-assets] ' + TAG + ' already has all 3 expected files — nothing to fix.');
  } else {
    console.log('[verify-release-assets] Done — ' + TAG + ' should now have the installer, blockmap, and latest.yml, and auto-update should find it.');
  }
}

main().catch((e) => {
  console.log('[verify-release-assets] Skipped: ' + e.message);
  process.exit(0);
});
