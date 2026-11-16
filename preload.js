const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('soisFocus', {
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  setEdges: (on) => ipcRenderer.send('set-edges', !!on),
  setAutostart: (enabled) => ipcRenderer.send('set-autostart', !!enabled),
  getAutostart: () => ipcRenderer.invoke('get-autostart'),
});
