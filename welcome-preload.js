const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('welcomeApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  meta: () => ipcRenderer.invoke('settings:meta'),
  faces: () => ipcRenderer.invoke('faces:list'),
  traced: () => ipcRenderer.invoke('faces:traced'),
  finish: (choices) => ipcRenderer.invoke('welcome:finish', choices),
});
