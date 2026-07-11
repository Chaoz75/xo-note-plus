// Preload for the small custom input-dialog windows (used to replace the
// broken prompt() in Electron for "New File", "New Folder", "Insert Link",
// etc). This keeps nodeIntegration off and contextIsolation on, same as
// every other window in the app, and exposes only the one thing that
// dialog's page actually needs: a way to send its result back to main.js.
//
// The channel name is passed in via additionalArguments rather than being
// guessable/shared, so one dialog's page can't send a result on behalf of
// a different one.
const { contextBridge, ipcRenderer } = require('electron');

const channelArg = process.argv.find((a) => a.startsWith('--dlg-channel='));
const channel = channelArg ? channelArg.slice('--dlg-channel='.length) : null;

contextBridge.exposeInMainWorld('dlgAPI', {
  send: (value) => {
    if (channel) ipcRenderer.send(channel, value);
  }
});
