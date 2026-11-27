const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('welcomeApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  finish: (choices) => ipcRenderer.invoke('welcome:finish', choices),
});
