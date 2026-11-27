const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  meta: () => ipcRenderer.invoke('settings:meta'),
  openPacks: () => ipcRenderer.invoke('packs:open'),
  faces: () => ipcRenderer.invoke('faces:list'),
  traced: () => ipcRenderer.invoke('faces:traced'),
  claude: {
    status: () => ipcRenderer.invoke('claude:status'),
    connect: () => ipcRenderer.invoke('claude:connect'),
    disconnect: () => ipcRenderer.invoke('claude:disconnect'),
  },
  updates: {
    status: () => ipcRenderer.invoke('updates:status'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    onStatus: (cb) => ipcRenderer.on('updates:status', (_e, status) => cb(status)),
  },
  save: (settings) => ipcRenderer.invoke('settings:save', settings),
  testNotify: () => ipcRenderer.send('settings:test-notify'),
  quit: () => ipcRenderer.send('settings:quit'),
});
