const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notch', {
  onState: (cb) => ipcRenderer.on('state', (_e, payload) => cb(payload)),
  onNotify: (cb) => ipcRenderer.on('notify', (_e, payload) => cb(payload)),
  onMusic: (cb) => ipcRenderer.on('music', (_e, payload) => cb(payload)),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, payload) => cb(payload)),
  onFocus: (cb) => ipcRenderer.on('focus', (_e, isOn) => cb(isOn)),
  onLevel: (cb) => ipcRenderer.on('level', (_e, level) => cb(level)),
  onAwake: (cb) => ipcRenderer.on('awake', (_e, isAwake) => cb(isAwake)),
  onTimer: (cb) => ipcRenderer.on('timer', (_e, payload) => cb(payload)),
  onActivity: (cb) => ipcRenderer.on('activity', (_e, payload) => cb(payload)),
  packs: () => ipcRenderer.invoke('packs:list'),
  media: (command) => ipcRenderer.invoke('media:control', command),
  setMouseIgnore: (ignore) => ipcRenderer.send('mouse-ignore', ignore),
  listen: () => ipcRenderer.send('listen'),
  cancelListen: () => ipcRenderer.send('cancel-listen'),
});
