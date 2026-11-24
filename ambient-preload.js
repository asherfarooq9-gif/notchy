const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ambient', {
  onFrame: (cb) => ipcRenderer.on('ambient:frame', (_e, payload) => cb(payload)),
});
