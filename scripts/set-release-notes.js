// Auto-fills a GitHub release's "release notes" body from the matching
// entry in src/renderer/utils/changelog.js, so you don't have to
// copy/paste the changelog into GitHub by hand every time you publish.
//
// Run after `npm run publish` (PUBLISH-UPDATE.bat does this automatically).
// Needs GH_TOKEN set in the environment, same as the publish step itself.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

const pkg = require('../package.json');
const GH_TOKEN = process.env.GH_TOKEN || '';
const publishCfg = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
const OWNER = publishCfg.owner || '';
const REPO = publishCfg.repo || '';
const VERSION = pkg.version;
const TAG = 'v' + VERSION;

function fail(msg) {
  console.log('[set-release-notes] Skipped: ' + msg);
  process.exit(0); // never fail the publish batch over this — it's a nice-to-have
}

if (!GH_TOKEN) fail('GH_TOKEN is not set in this window.');
if (!OWNER || !REPO) fail('Could not read owner/repo from package.json build.publish config.');

// ── Load CHANGELOG from the renderer file (it has no module.exports,
// so we run it in a fresh VM context and pull the variable back out) ──
function loadChangelog() {
  const changelogPath = path.join(__dirname, '..', 'src', 'renderer', 'utils', 'changelog.js');
  const src = fs.readFileSync(changelogPath, 'utf-8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.__CHANGELOG__ = CHANGELOG;', sandbox, { filename: 'changelog.js' });
  return sandbox.__CHANGELOG__ || [];
}

function buildNotesText(entry) {
  if (!entry) return '';
  const lines = (entry.changes || []).map((c) => '- ' + c);
  return lines.join('\n');
}

function ghRequest(method, urlPath, body) {
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
        } else {
          reject(new Error('GitHub API ' + method + ' ' + urlPath + ' failed: ' + res.statusCode + ' ' + data));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const changelog = loadChangelog();
  const entry = changelog.find((e) => e.version === VERSION);
  if (!entry) fail('No changelog.js entry found for version ' + VERSION + '.');

  const notes = buildNotesText(entry);
  if (!notes) fail('Changelog entry for ' + VERSION + ' has no changes listed.');

  console.log('[set-release-notes] Looking for release tagged ' + TAG + '...');
  // Use the list endpoint (not /releases/tags/:tag) since that lookup
  // only resolves published releases, and electron-builder uploads as drafts.
  const releases = await ghRequest('GET', '/repos/' + OWNER + '/' + REPO + '/releases?per_page=30');
  const matches = (releases || []).filter((r) => r.tag_name === TAG);

  if (!matches.length) fail('No release found on GitHub tagged ' + TAG + ' yet (it may still be processing).');

  for (const r of matches) {
    await ghRequest('PATCH', '/repos/' + OWNER + '/' + REPO + '/releases/' + r.id, { body: notes });
    console.log('[set-release-notes] Updated release notes on ' + (r.draft ? 'draft' : 'published') + ' release #' + r.id + '.');
  }
  console.log('[set-release-notes] Done.');
}

main().catch((e) => {
  console.log('[set-release-notes] Skipped: ' + e.message);
  process.exit(0);
});
