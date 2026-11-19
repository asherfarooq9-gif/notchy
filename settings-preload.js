const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  meta: () => ipcRenderer.invoke('settings:meta'),
  openPacks: () => ipcRenderer.invoke('packs:open'),
  claude: {
    status: () => ipcRenderer.invoke('claude:status'),
    connect: () => ipcRenderer.invoke('claude:connect'),
    disconnect: () => ipcRenderer.invoke('claude:disconnect'),
  },
  save: (settings) => ipcRenderer.invoke('settings:save', settings),
  testNotify: () => ipcRenderer.send('settings:test-notify'),
  quit: () => ipcRenderer.send('settings:quit'),
  startMicTest: () => ipcRenderer.send('mic-test:start'),
  stopMicTest: () => ipcRenderer.send('mic-test:stop'),
  onMicTest: (cb) => ipcRenderer.on('mic-test', (_e, message) => cb(message)),
});
