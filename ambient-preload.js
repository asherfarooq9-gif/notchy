const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ambient', {
  onFrame: (cb) => ipcRenderer.on('ambient:frame', (_e, payload) => cb(payload)),
  onStart: (cb) => ipcRenderer.on('ambient:start', (_e, payload) => cb(payload)),
  sendPixels: (bytes) => ipcRenderer.send('ambient:pixels', bytes),
  fail: (message) => ipcRenderer.send('ambient:fail', String(message)),
});
