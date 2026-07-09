// electron-builder + GitHub's draft-release-by-tag limitation sometimes
// causes a single `npm run publish` to create TWO separate draft releases
// for the same version instead of one, splitting the .exe, .blockmap, and
// latest.yml across them. This script runs right after publishing, finds
// that split if it happened, and automatically merges every file into a
// single release (preferring the one that's actually tagged v<version>),
// deleting the leftover empty duplicate draft — no more manual dragging
// files between releases on GitHub.

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const pkg = require('../package.json');
const GH_TOKEN = process.env.GH_TOKEN || '';
const publishCfg = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
const OWNER = publishCfg.owner || '';
const REPO = publishCfg.repo || '';
const VERSION = pkg.version;
const TAG = 'v' + VERSION;

function skip(msg) {
  console.log('[merge-split-release] ' + msg);
  process.exit(0); // never fail the publish batch over this — it's a nice-to-have cleanup step
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

function downloadAssetToFile(assetApiUrl, destPath) {
  return new Promise((resolve, reject) => {
    const doRequest = (url, headers) => {
      https.get(url, { headers: headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Redirects to GitHub's signed storage URL shouldn't carry our auth header
          doRequest(res.headers.location, { 'User-Agent': 'xo-note-plus-publish-script' });
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('Download failed with status ' + res.statusCode));
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
        file.on('error', reject);
      }).on('error', reject);
    };
    doRequest(assetApiUrl, {
      'Authorization': 'token ' + GH_TOKEN,
      'User-Agent': 'xo-note-plus-publish-script',
      'Accept': 'application/octet-stream'
    });
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

async function main() {
  console.log('[merge-split-release] Checking for a split release on ' + TAG + '...');
  const releases = await ghApi('GET', '/repos/' + OWNER + '/' + REPO + '/releases?per_page=30');

  // GitHub only ever allows ONE release per tag, so the release actually
  // tagged v<version> — whether it's a draft or already published (releaseType
  // "release" auto-publishes it the moment the upload finishes) — is always
  // the correct merge target. Any OTHER release from the same botched publish
  // is a leftover: GitHub couldn't resolve the draft-in-progress by tag, so it
  // stuck the rest of the files under a throwaway "untagged-..." draft instead.
  // Those leftovers are always drafts, and those are the only releases this
  // script ever deletes — a published release is never touched or removed.
  const taggedRelease = (releases || []).find((r) => r.tag_name === TAG);
  const leftoverDrafts = (releases || []).filter((r) => {
    if (!r.draft) return false;
    if (r.tag_name === TAG) return false; // that IS taggedRelease, not a leftover
    if ((r.tag_name || '').indexOf('untagged-') === 0) return true;
    return (r.assets || []).some((a) => a.name.indexOf(VERSION) !== -1);
  });

  let primary = taggedRelease;
  let secondaries = leftoverDrafts;
  if (!primary) {
    // No release is tagged v<version> yet (unusual, but fall back to
    // whichever leftover draft has the most assets so there's still a
    // sensible merge target).
    secondaries = leftoverDrafts.slice().sort((a, b) => (b.assets || []).length - (a.assets || []).length);
    primary = secondaries.shift();
  }

  if (!primary || secondaries.length === 0) {
    skip('No split found for this version — nothing to merge.');
    return;
  }

  console.log('[merge-split-release] Found ' + (secondaries.length + 1) + ' release(s) for this version — merging everything into release #' + primary.id + ' (tag: ' + (primary.tag_name || 'untagged') + (primary.draft ? ', draft' : ', published') + ')...');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xo-note-merge-'));
  const primaryNames = new Set((primary.assets || []).map((a) => a.name));

  try {
    for (const secondary of secondaries) {
      for (const asset of (secondary.assets || [])) {
        if (primaryNames.has(asset.name)) continue; // already present in the primary release
        console.log('[merge-split-release] Moving ' + asset.name + ' into release #' + primary.id + '...');
        const tmpFile = path.join(tmpDir, asset.name);
        const assetApiUrl = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases/assets/' + asset.id;
        await downloadAssetToFile(assetApiUrl, tmpFile);
        await uploadAsset(primary.id, tmpFile, asset.name);
        primaryNames.add(asset.name);
      }
      if (!secondary.draft) {
        console.log('[merge-split-release] Skipping delete of #' + secondary.id + ' — it is not a draft, leaving it alone as a safety measure.');
        continue;
      }
      console.log('[merge-split-release] Deleting now-empty duplicate draft #' + secondary.id + '...');
      await ghApi('DELETE', '/repos/' + OWNER + '/' + REPO + '/releases/' + secondary.id);
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { }
  }

  console.log('[merge-split-release] Done — release #' + primary.id + ' now holds every file' + (primary.draft ? ' (still a draft).' : ' and is live.'));
}

main().catch((e) => {
  console.log('[merge-split-release] Skipped: ' + e.message);
  process.exit(0);
});
