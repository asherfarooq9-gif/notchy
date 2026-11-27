const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notch', {
  onState: (cb) => ipcRenderer.on('state', (_e, payload) => cb(payload)),
  onNotify: (cb) => ipcRenderer.on('notify', (_e, payload) => cb(payload)),
  onMusic: (cb) => ipcRenderer.on('music', (_e, payload) => cb(payload)),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, payload) => cb(payload)),
  onFocus: (cb) => ipcRenderer.on('focus', (_e, isOn) => cb(isOn)),
  onAwake: (cb) => ipcRenderer.on('awake', (_e, isAwake) => cb(isAwake)),
  onTimer: (cb) => ipcRenderer.on('timer', (_e, payload) => cb(payload)),
  onActivity: (cb) => ipcRenderer.on('activity', (_e, payload) => cb(payload)),
  packs: () => ipcRenderer.invoke('packs:list'),
  traced: () => ipcRenderer.invoke('faces:traced'),
  media: (command) => ipcRenderer.invoke('media:control', command),
  setMouseIgnore: (ignore) => ipcRenderer.send('mouse-ignore', ignore),
  openPanel: () => ipcRenderer.send('open-panel'),
  cancelAsk: () => ipcRenderer.send('cancel-ask'),
});
