const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  windowControl: {
    minimize: () => ipcRenderer.send('window-control', 'minimize'),
    maximize: () => ipcRenderer.send('window-control', 'maximize'),
    unmaximize: () => ipcRenderer.send('window-control', 'unmaximize'),
    close: () => ipcRenderer.send('window-control', 'close'),
    setAlwaysOnTop: (flag) => ipcRenderer.send('window-control', 'set-always-on-top', flag),
    setOpacity: (val) => ipcRenderer.send('window-control', 'set-opacity', val),
    resize: (bounds) => ipcRenderer.send('window-control', 'resize', bounds),
    getBounds: () => ipcRenderer.invoke('get-window-bounds'),
    onStateChange: (callback) => ipcRenderer.on('window-state-changed', (event, state) => callback(state))
  },
  file: {
    openDialog: () => ipcRenderer.invoke('file-open-dialog'),
    read: (filePath) => ipcRenderer.invoke('file-read', filePath)
  },
  data: {
    save: (data) => ipcRenderer.invoke('data-save', data),
    load: () => ipcRenderer.invoke('data-load')
  }
});
