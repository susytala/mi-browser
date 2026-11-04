const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  onOpenTab: (cb) => ipcRenderer.on('open-tab', (_e, url) => cb(url))
});
