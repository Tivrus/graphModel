const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('graphModel', {
  isElectron: true,
  platform: process.platform,
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
});
