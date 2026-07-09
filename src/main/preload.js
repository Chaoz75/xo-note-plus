const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xo', {
  // Vault
  selectVault: () => ipcRenderer.invoke('select-vault'),
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),

  // File system
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  createFile: (filePath) => ipcRenderer.invoke('create-file', filePath),
  createFolder: (folderPath) => ipcRenderer.invoke('create-folder', folderPath),
  renameItem: (oldPath, newPath) => ipcRenderer.invoke('rename-item', oldPath, newPath),
  deleteItem: (itemPath) => ipcRenderer.invoke('delete-item', itemPath),
  moveItem: (srcPath, destDir) => ipcRenderer.invoke('move-item', srcPath, destDir),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  searchFiles: (query) => ipcRenderer.invoke('search-files', query),
  showInExplorer: (filePath) => ipcRenderer.invoke('show-in-explorer', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  exportPdf: (html, filePath) => ipcRenderer.invoke('export-pdf', html, filePath),
  getPendingOpenFile: () => ipcRenderer.invoke('get-pending-open-file'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  selectBackgroundImage: () => ipcRenderer.invoke('select-background-image'),
  clearBackgroundImage: () => ipcRenderer.invoke('clear-background-image'),
  exportThemeFile: (themeJson) => ipcRenderer.invoke('export-theme-file', themeJson),
  importThemeFile: () => ipcRenderer.invoke('import-theme-file'),
  onOpenFilePath: (callback) => ipcRenderer.on('open-file-path', (e, p) => callback(p)),
  ensureDirectory: (dirPath) => ipcRenderer.invoke('ensure-directory', dirPath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  copyExternalItem: (srcPath, destDir) => ipcRenderer.invoke('copy-external-item', srcPath, destDir),

  // Dialogs
  showInputDialog: (title, label, defaultValue) => ipcRenderer.invoke('show-input-dialog', title, label, defaultValue),

  // Path utils
  getPathSep: () => ipcRenderer.invoke('get-path-sep'),
  joinPath: (...parts) => ipcRenderer.invoke('join-path', ...parts),
  dirname: (p) => ipcRenderer.invoke('dirname', p),
  basename: (p) => ipcRenderer.invoke('basename', p),

  // Config
  saveConfig: (config) => ipcRenderer.invoke('save-app-config', config),
  loadConfig: () => ipcRenderer.invoke('load-app-config'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  forceClose: () => ipcRenderer.invoke('force-close'),

  // Events
  onAppClosing: (callback) => ipcRenderer.on('app-closing', callback),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (e, data) => callback(data)),
  startDownloadLatest: () => ipcRenderer.invoke('start-download-latest'),
  listReleases: () => ipcRenderer.invoke('list-releases'),
  downloadSpecificVersion: (assetId, version) => ipcRenderer.invoke('download-specific-version', assetId, version),
  installDownloadedFile: (filePath) => ipcRenderer.invoke('install-downloaded-file', filePath),
  onManualDownloadProgress: (callback) => ipcRenderer.on('download-progress-manual', (e, data) => callback(data))
});
// XO NOTE+ preload — exposes safe IPC bridge to renderer
