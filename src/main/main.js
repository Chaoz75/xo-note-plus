const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const pkg = require('../../package.json');

let mainWindow;
let vaultPath = null;
const CONFIG_PATH = path.join(app.getPath('userData'), 'xonote-config.json');

// ── Auto-Update (GitHub Releases) ──────────────────────────
// xo-note-plus publishes to a PUBLIC GitHub repo, so checking for and
// downloading releases needs no authentication at all — GH_TOKEN below stays
// blank for every installed copy of the app and that's expected and fine.
//
// GH_TOKEN is only ever read from the environment (never hardcoded here), and
// is only actually used by the local publishing scripts (PUBLISH-UPDATE.bat)
// to raise GitHub's API rate limit and to merge/annotate releases after
// publishing. The installed app itself doesn't need it to check for or
// download updates, since public repos are readable by anyone.
const GH_TOKEN = process.env.GH_TOKEN || '';

const GH_PUBLISH_CFG = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
const GH_OWNER = GH_PUBLISH_CFG.owner || '';
const GH_REPO = GH_PUBLISH_CFG.repo || '';

// autoDownload is OFF: we show the user a choice (Update to Latest / Choose
// Other Version) before anything downloads, instead of silently grabbing
// the latest version the moment one is found.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false; // we prompt the user via the bottom-right button instead of installing silently on quit
if (GH_TOKEN) {
  autoUpdater.requestHeaders = { Authorization: 'token ' + GH_TOKEN };
}

function sendUpdateStatus(status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...(extra || {}) });
  }
}

autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { version: info.version, notes: info.releaseNotes || '' }));
autoUpdater.on('update-not-available', () => sendUpdateStatus('up-to-date'));
autoUpdater.on('download-progress', (p) => sendUpdateStatus('downloading', { percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', (info) => sendUpdateStatus('ready', { version: info.version }));
autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err);
  sendUpdateStatus('up-to-date'); // fail quiet — don't alarm the user over a failed check
});

function checkForUpdatesSafely() {
  // electron-updater throws when the app isn't packaged (i.e. running via
  // `npm start` in dev) — skip in that case instead of erroring every time.
  if (!app.isPackaged) return;
  try { autoUpdater.checkForUpdates(); } catch (e) { console.error('checkForUpdates failed:', e); }
}

// Only the SCHEDULED (launch + hourly) checks respect the "Auto Update"
// settings toggle — a manual "check now" click always works regardless,
// since that's an explicit ask from the user in the moment.
function checkForUpdatesIfEnabled() {
  const cfg = loadConfig();
  // The toggle lives under the renderer's settings object (saved via
  // saveConfig({ settings: {...} })), not at the config's top level.
  const settings = cfg.settings || {};
  if (settings.autoUpdateEnabled === false) return;
  checkForUpdatesSafely();
}

// ── GitHub API helper (used for listing releases + downloading a specific
// non-latest version's installer — electron-updater itself only ever
// targets "latest", so anything else needs a direct API call). ──
function githubApiRequest(urlPath, extraHeaders) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      headers: {
        'User-Agent': 'xo-note-plus',
        Accept: 'application/vnd.github+json',
        ...(GH_TOKEN ? { Authorization: 'token ' + GH_TOKEN } : {}),
        ...(extraHeaders || {})
      }
    };
    https.get(options, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: buf });
        } else {
          reject(new Error('GitHub API ' + res.statusCode + ' for ' + urlPath));
        }
      });
    }).on('error', reject);
  });
}

// Downloads a URL following redirects (GitHub asset downloads 302 to a
// signed storage URL), reporting progress back to the renderer.
function downloadWithRedirects(url, destPath, headers) {
  return new Promise((resolve, reject) => {
    const request = (u, hdrs) => {
      https.get(u, { headers: hdrs }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Redirects to signed storage URLs shouldn't carry our auth header
          request(res.headers.location, { 'User-Agent': 'xo-note-plus' });
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('Download failed with status ' + res.statusCode));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          received += chunk.length;
          const percent = total ? Math.round((received / total) * 100) : 0;
          sendManualDownloadProgress(percent);
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
        file.on('error', reject);
      }).on('error', reject);
    };
    request(url, {
      'User-Agent': 'xo-note-plus',
      Accept: 'application/octet-stream',
      ...(headers || {})
    });
  });
}

function sendManualDownloadProgress(percent) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress-manual', { percent });
  }
}

// ── Single instance + "Open with XO NOTE+" support ──
// Extract a real file path from command-line args (double-clicked file)
function getFileFromArgv(argv) {
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a || a.startsWith('-')) continue;
    if (a === '.' || /electron(\.exe)?$/i.test(a) || /xo.?note.*\.exe$/i.test(a)) continue;
    try {
      if (fs.existsSync(a) && fs.statSync(a).isFile()) return a;
    } catch (e) { }
  }
  return null;
}

let pendingOpenFile = getFileFromArgv(process.argv);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // Another XO NOTE+ is already running — hand the file over to it and exit
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    const file = getFileFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (file) mainWindow.webContents.send('open-file-path', file);
    }
  });
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return data;
    }
  } catch (e) { }
  return {};
}

function saveConfig(config) {
  try {
    const existing = loadConfig();
    const merged = { ...existing, ...config };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  } catch (e) { console.error('Failed to save config:', e); }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '..', 'renderer', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon-256.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('app-closing');
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Check shortly after launch (let the window finish loading first), then
  // periodically while the app stays open.
  setTimeout(checkForUpdatesIfEnabled, 4000);
  setInterval(checkForUpdatesIfEnabled, 60 * 60 * 1000);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC Handlers ──────────────────────────────────────────

ipcMain.handle('select-vault', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose your XO NOTE+ Vault Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths[0]) {
    vaultPath = result.filePaths[0];
    saveConfig({ vaultPath });
    return vaultPath;
  }
  return null;
});

ipcMain.handle('get-vault-path', () => {
  if (vaultPath) return vaultPath;
  const config = loadConfig();
  if (config.vaultPath && fs.existsSync(config.vaultPath)) {
    vaultPath = config.vaultPath;
    return vaultPath;
  }
  return null;
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const targetPath = dirPath || vaultPath;
    if (!targetPath) return [];
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: path.join(targetPath, e.name),
        isDirectory: e.isDirectory(),
        ext: path.extname(e.name).toLowerCase(),
        modified: fs.statSync(path.join(targetPath, e.name)).mtime.toISOString()
      }))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (e) { return []; }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    // Read as buffer first so we can detect encoding (Notepad .txt files
    // are often UTF-16 or have a BOM — reading those as utf-8 gives
    // blank/garbled content in the editor)
    const buf = fs.readFileSync(filePath);
    let content;
    if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
      content = buf.slice(2).toString('utf16le');                 // UTF-16 LE BOM
    } else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
      content = buf.slice(2).swap16().toString('utf16le');        // UTF-16 BE BOM
    } else if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      content = buf.slice(3).toString('utf-8');                   // UTF-8 BOM
    } else {
      content = buf.toString('utf-8');
      // Heuristic: BOM-less UTF-16 LE (lots of NUL bytes)
      if (content.length > 0) {
        const sample = content.slice(0, 512);
        let nulls = 0;
        for (let i = 0; i < sample.length; i++) if (sample.charCodeAt(i) === 0) nulls++;
        if (nulls / sample.length > 0.2) content = buf.toString('utf16le');
      }
    }
    // Normalize line endings and strip stray NUL characters
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    content = content.split(String.fromCharCode(0)).join('');
    return content;
  }
  catch (e) { return null; }
});

// Renderer asks for a file passed on the command line at startup
ipcMain.handle('get-pending-open-file', () => {
  const f = pendingOpenFile;
  pendingOpenFile = null;
  return f;
});

// Export rendered note HTML to a PDF file (used by Save As → PDF)
ipcMain.handle('export-pdf', async (event, html, filePath) => {
  let win = null;
  const tmpHtml = path.join(app.getPath('temp'), 'xonote-export-' + Date.now() + '.html');
  try {
    fs.writeFileSync(tmpHtml, html, 'utf-8');
    win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    await win.loadFile(tmpHtml);
    const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    fs.writeFileSync(filePath, data);
    win.destroy();
    try { fs.unlinkSync(tmpHtml); } catch (e) { }
    return true;
  } catch (e) {
    console.error('Export PDF error:', e);
    if (win) try { win.destroy(); } catch (e2) { }
    try { fs.unlinkSync(tmpHtml); } catch (e2) { }
    return false;
  }
});

// Open a URL in the user's default browser (validated)
ipcMain.handle('open-external', async (event, url) => {
  try {
    const u = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  } catch (e) { return false; }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try { fs.writeFileSync(filePath, content, 'utf-8'); return true; }
  catch (e) { return false; }
});

ipcMain.handle('create-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf-8');
    }
    return true;
  } catch (e) { return false; }
});

ipcMain.handle('create-folder', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return true;
  } catch (e) { return false; }
});

ipcMain.handle('rename-item', async (event, oldPath, newPath) => {
  try { fs.renameSync(oldPath, newPath); return true; }
  catch (e) { return false; }
});

ipcMain.handle('delete-item', async (event, itemPath) => {
  try {
    // Send to OS recycle bin instead of permanent delete
    await shell.trashItem(itemPath);
    return true;
  } catch (e) {
    // Fallback to permanent delete if trash fails
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
      return true;
    } catch (e2) { return false; }
  }
});

ipcMain.handle('move-item', async (event, srcPath, destDir) => {
  try {
    const name = path.basename(srcPath);
    const destPath = path.join(destDir, name);
    fs.renameSync(srcPath, destPath);
    return destPath;
  } catch (e) { return null; }
});

ipcMain.handle('get-file-stats', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    return {
      size: stat.size,
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString()
    };
  } catch (e) { return null; }
});

ipcMain.handle('search-files', async (event, query) => {
  if (!vaultPath || !query) return [];
  const results = [];
  function searchDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
          const nameMatch = entry.name.toLowerCase().includes(query.toLowerCase());
          let contentMatch = false;
          let matchLine = '';
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                contentMatch = true;
                matchLine = line.trim().substring(0, 120);
                break;
              }
            }
          } catch (e) { }
          if (nameMatch || contentMatch) {
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath: path.relative(vaultPath, fullPath),
              nameMatch,
              contentMatch,
              matchLine
            });
          }
        }
      }
    } catch (e) { }
  }
  searchDir(vaultPath);
  return results.slice(0, 50);
});

// Custom input dialog (replaces broken prompt() in Electron)
ipcMain.handle('show-input-dialog', async (event, title, label, defaultValue) => {
  return new Promise((resolve) => {
    const dlg = new BrowserWindow({
      width: 420, height: 185,
      parent: mainWindow, modal: true,
      frame: false, resizable: false,
      backgroundColor: '#13131d',
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    const uid = 'dlg-' + Date.now();
    const escaped = (defaultValue || '').replace(/\\/g,'\\\\').replace(/"/g,'&quot;');
    const html = `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',sans-serif;background:#13131d;color:#e4e4ef;padding:24px;display:flex;flex-direction:column;height:100vh}
      h3{font-size:14px;font-weight:600;margin-bottom:6px}
      label{font-size:12px;color:#9999b3;margin-bottom:8px;display:block}
      input{width:100%;background:#0e0e16;border:1px solid #2a2a40;color:#e4e4ef;border-radius:6px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit}
      input:focus{border-color:#4fc3f7}
      .btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
      button{padding:8px 20px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-family:inherit}
      .ok{background:#4fc3f7;color:#000;font-weight:600}.ok:hover{filter:brightness(1.15)}
      .cancel{background:#1e1e2e;color:#9999b3;border:1px solid #2a2a40}.cancel:hover{background:#252540}
    </style></head><body>
      <h3>${title}</h3><label>${label}</label>
      <input id="inp" type="text" value="${escaped}" autofocus>
      <div class="btns">
        <button class="cancel" onclick="send(null)">Cancel</button>
        <button class="ok" onclick="send(document.getElementById('inp').value)">OK</button>
      </div>
      <script>
        const {ipcRenderer}=require('electron');
        document.getElementById('inp').select();
        document.getElementById('inp').addEventListener('keydown',e=>{
          if(e.key==='Enter')send(document.getElementById('inp').value);
          if(e.key==='Escape')send(null);
        });
        function send(v){ipcRenderer.send('${uid}',v);window.close()}
      </script></body></html>`;
    dlg.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    ipcMain.once(uid, (ev, val) => resolve(val));
    dlg.on('closed', () => resolve(null));
  });
});

ipcMain.handle('save-app-config', async (event, config) => {
  saveConfig(config);
  return true;
});

ipcMain.handle('load-app-config', async () => {
  return loadConfig();
});

ipcMain.handle('window-minimize', () => { mainWindow?.minimize(); });
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => { mainWindow?.destroy(); app.quit(); });
ipcMain.handle('force-close', () => { mainWindow?.destroy(); app.quit(); });

ipcMain.handle('show-in-explorer', async (event, filePath) => {
  try {
    const normalized = path.normalize(filePath);
    shell.showItemInFolder(normalized);
  } catch (e) { console.error('Show in explorer error:', e); }
});

// Ensure directory exists (for calendar day folders)
ipcMain.handle('ensure-directory', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (e) { return false; }
});

// Check if file exists
ipcMain.handle('file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('get-app-version', () => app.getVersion());

// Auto-update: manual "check now" click + "restart to install" click.
// Manual checks always run, regardless of the "Auto Update" settings toggle
// (that toggle only silences the automatic launch/hourly checks).
ipcMain.handle('check-for-updates', () => { checkForUpdatesSafely(); });
ipcMain.handle('quit-and-install', () => { autoUpdater.quitAndInstall(); });

// User picked "Update to Latest Version" in the picker — now actually
// download it (autoDownload is off, so nothing happened until this call).
ipcMain.handle('start-download-latest', () => {
  try { autoUpdater.downloadUpdate(); } catch (e) { console.error('downloadUpdate failed:', e); }
});

// List every published (non-draft, non-prerelease-hidden) release so the
// "Choose Other Version" picker can show the full history, including
// versions older than what's currently installed.
ipcMain.handle('list-releases', async () => {
  if (!GH_OWNER || !GH_REPO) return [];
  try {
    const res = await githubApiRequest('/repos/' + GH_OWNER + '/' + GH_REPO + '/releases?per_page=30');
    const releases = JSON.parse(res.body.toString('utf-8'));
    return releases
      .filter(r => !r.draft)
      .map(r => {
        const exeAsset = (r.assets || []).find(a => a.name.toLowerCase().endsWith('.exe'));
        return {
          version: (r.tag_name || '').replace(/^v/, ''),
          tagName: r.tag_name,
          name: r.name,
          notes: r.body || '',
          publishedAt: r.published_at,
          prerelease: !!r.prerelease,
          assetId: exeAsset ? exeAsset.id : null,
          assetName: exeAsset ? exeAsset.name : null,
          assetSize: exeAsset ? exeAsset.size : null
        };
      })
      .filter(r => r.assetId); // only versions that actually have a downloadable installer
  } catch (e) {
    console.error('list-releases failed:', e);
    return [];
  }
});

// Download a SPECIFIC (not necessarily latest) version's installer asset
// directly via the GitHub API, since electron-updater's delta-update
// mechanism only ever targets the newest release.
ipcMain.handle('download-specific-version', async (event, assetId, version) => {
  if (!GH_OWNER || !GH_REPO || !assetId) return null;
  try {
    const destPath = path.join(app.getPath('temp'), 'xo-note-plus-setup-' + version + '.exe');
    const assetApiUrl = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/releases/assets/' + assetId;
    await downloadWithRedirects(assetApiUrl, destPath, {
      Accept: 'application/octet-stream',
      ...(GH_TOKEN ? { Authorization: 'token ' + GH_TOKEN } : {})
    });
    return destPath;
  } catch (e) {
    console.error('download-specific-version failed:', e);
    return null;
  }
});

// Launch a downloaded installer (from download-specific-version) and quit
// so it can replace the running app, same as a normal update install.
ipcMain.handle('install-downloaded-file', (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 500);
    return true;
  } catch (e) { console.error('install-downloaded-file failed:', e); return false; }
});

// Custom background image (Settings > Appearance): pick an image and copy
// it into userData so it keeps working even if the original file moves.
ipcMain.handle('select-background-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a Background Image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    const srcPath = result.filePaths[0];
    const ext = path.extname(srcPath).toLowerCase() || '.png';
    const destDir = path.join(app.getPath('userData'), 'custom-bg');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, 'background' + ext);
    // Clear any previous background with a different extension
    try {
      for (const f of fs.readdirSync(destDir)) {
        if (f.startsWith('background')) fs.unlinkSync(path.join(destDir, f));
      }
    } catch (e) { }
    fs.copyFileSync(srcPath, destPath);
    return destPath;
  } catch (e) {
    console.error('Select background image error:', e);
    return null;
  }
});

ipcMain.handle('clear-background-image', async () => {
  try {
    const destDir = path.join(app.getPath('userData'), 'custom-bg');
    if (fs.existsSync(destDir)) {
      for (const f of fs.readdirSync(destDir)) fs.unlinkSync(path.join(destDir, f));
    }
    return true;
  } catch (e) { return false; }
});

// Custom Theme import/export (Settings > Appearance > Custom Theme Builder)
// so a theme built in one install of XO NOTE+ can be shared/reused elsewhere.
ipcMain.handle('export-theme-file', async (event, themeJson) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Custom Theme',
    defaultPath: 'xo-note-theme.json',
    filters: [{ name: 'XO NOTE+ Theme', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return false;
  try {
    fs.writeFileSync(result.filePath, themeJson, 'utf-8');
    return true;
  } catch (e) {
    console.error('Export theme error:', e);
    return false;
  }
});

ipcMain.handle('import-theme-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Custom Theme',
    properties: ['openFile'],
    filters: [{ name: 'XO NOTE+ Theme', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    return fs.readFileSync(result.filePaths[0], 'utf-8');
  } catch (e) {
    console.error('Import theme error:', e);
    return null;
  }
});

ipcMain.handle('get-path-sep', () => path.sep);
ipcMain.handle('join-path', (event, ...parts) => path.join(...parts));
ipcMain.handle('dirname', (event, p) => path.dirname(p));
ipcMain.handle('basename', (event, p) => path.basename(p, path.extname(p)));

// Copy external file/folder into vault
ipcMain.handle('copy-external-item', async (event, srcPath, destDir) => {
  try {
    const name = path.basename(srcPath);
    const destPath = path.join(destDir, name);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      // Recursively copy directory
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    return destPath;
  } catch (e) { console.error('Copy external item error:', e); return null; }
});

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
