// Posts a "new version is out" announcement to a Discord channel using your
// bot, right after PUBLISH-UPDATE.bat finishes publishing. Pulls the version
// number from package.json and the bullet points straight from the matching
// entry in src/renderer/utils/changelog.js, so the Discord post always
// matches what people see in the in-app changelog panel.
//
// Needs two things set as environment variables in the SAME window you run
// PUBLISH-UPDATE.bat from (never typed into a script or committed to git):
//   DISCORD_BOT_TOKEN   — your bot's token, from the Discord Developer Portal
//   DISCORD_CHANNEL_ID  — the channel to post in (right-click it in Discord
//                          with Developer Mode on > Copy Channel ID)
//
// Your bot also needs to already be a member of the server, with "View
// Channel" and "Send Messages" (and "Embed Links") permission on that
// channel — same as any other bot.
//
// Set them once with (PowerShell):
//   setx DISCORD_BOT_TOKEN "your-bot-token-here"
//   setx DISCORD_CHANNEL_ID "123456789012345678"
// Then close and reopen any PowerShell windows so they pick up the change.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

const pkg = require('../package.json');
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '';
const VERSION = pkg.version;
const publishCfg = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
const OWNER = publishCfg.owner || '';
const REPO = publishCfg.repo || '';

function skip(msg) {
  console.log('[discord-announce] ' + msg);
  process.exit(0); // never fail the publish batch over this — it's an announcement, not a build step
}

if (!BOT_TOKEN) skip('DISCORD_BOT_TOKEN is not set in this window, skipping.');
if (!CHANNEL_ID) skip('DISCORD_CHANNEL_ID is not set in this window, skipping.');
if (!OWNER || !REPO) skip('Could not read owner/repo from package.json build.publish config.');

// changelog.js is written for the renderer (no module.exports), so it's
// loaded here the same way the browser would run it — just enough of a
// sandbox to grab the CHANGELOG array back out.
function loadChangelog() {
  const changelogPath = path.join(__dirname, '../src/renderer/utils/changelog.js');
  const src = fs.readFileSync(changelogPath, 'utf-8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.__CHANGELOG__ = CHANGELOG;', sandbox);
  return sandbox.__CHANGELOG__ || [];
}

function ghApiGet(urlPath) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.github.com',
      path: urlPath,
      headers: { 'User-Agent': 'xo-note-plus-publish-script', 'Accept': 'application/vnd.github+json' }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
        } else {
          reject(new Error('GET ' + urlPath + ' -> ' + res.statusCode + ' ' + data));
        }
      });
    }).on('error', reject);
  });
}

function discordPost(channelId, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'discord.com',
      path: '/api/v10/channels/' + channelId + '/messages',
      method: 'POST',
      headers: {
        'Authorization': 'Bot ' + BOT_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data ? JSON.parse(data) : null);
        else reject(new Error('Discord POST -> ' + res.statusCode + ' ' + data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const TAG = 'v' + VERSION;
  console.log('[discord-announce] Announcing ' + TAG + ' to Discord...');

  const changelog = loadChangelog();
  const entry = changelog.find((e) => e.version === VERSION);
  if (!entry) skip('No changelog.js entry found for version ' + VERSION + ' — add one before publishing so the announcement has content.');

  // Confirm the GitHub release actually exists (and is fully uploaded) before
  // announcing it — no point telling people to download something that
  // isn't there yet if this ran before the release finished propagating.
  let release = null;
  try {
    release = await ghApiGet('/repos/' + OWNER + '/' + REPO + '/releases/tags/' + TAG);
  } catch (e) {
    skip('Could not find a published GitHub release for ' + TAG + ' yet (' + e.message + ') — skipping the Discord post.');
  }
  const releaseUrl = (release && release.html_url) || ('https://github.com/' + OWNER + '/' + REPO + '/releases/tag/' + TAG);

  let description = entry.changes.map((c) => '• ' + c).join('\n');
  if (description.length > 3800) description = description.slice(0, 3800) + '…';

  const embed = {
    title: 'XO NOTE+ ' + TAG + ' is out!',
    url: releaseUrl,
    description: description,
    color: 0x4fc3f7,
    fields: [
      { name: 'Download', value: '[Get it on GitHub](' + releaseUrl + ')' }
    ],
    footer: { text: 'XO NOTE+ — XOS · XO Systems' },
    timestamp: new Date().toISOString()
  };

  await discordPost(CHANNEL_ID, { embeds: [embed] });
  console.log('[discord-announce] Posted ' + TAG + ' announcement to Discord channel ' + CHANNEL_ID + '.');
}

main().catch((e) => {
  console.log('[discord-announce] Skipped: ' + e.message);
  process.exit(0);
});
