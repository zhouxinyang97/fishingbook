const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: (flag) => ipcRenderer.send('toggle-always-on-top', flag),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  loadFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  openFile: () => ipcRenderer.invoke('open-file'),
  getLastSession: () => ipcRenderer.invoke('get-last-session'),
  saveSession: (session) => ipcRenderer.send('save-session', session),
  resizeWindow: (bounds) => ipcRenderer.send('resize-window', bounds),
  onWindowStateChange: (callback) => ipcRenderer.on('window-state-change', (event, state) => callback(state))
});
