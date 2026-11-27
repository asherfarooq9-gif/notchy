const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('welcomeApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  meta: () => ipcRenderer.invoke('settings:meta'),
  finish: (choices) => ipcRenderer.invoke('welcome:finish', choices),
});
