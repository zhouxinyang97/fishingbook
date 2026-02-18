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
  onWindowStateChange: (callback) => ipcRenderer.on('window-state-change', (event, state) => callback(state)),

  settingsGet: () => ipcRenderer.invoke('v2:settings:get'),
  settingsUpdate: (patch) => ipcRenderer.invoke('v2:settings:update', patch),

  libraryList: () => ipcRenderer.invoke('v2:library:list'),
  libraryChooseFolderAndAdd: () => ipcRenderer.invoke('v2:library:chooseFolderAndAdd'),
  librarySetActive: (libraryId) => ipcRenderer.invoke('v2:library:setActive', { libraryId }),
  libraryRemove: (libraryId) => ipcRenderer.invoke('v2:library:remove', { libraryId }),

  bookList: (libraryId) => ipcRenderer.invoke('v2:book:list', { libraryId }),
  bookImportFiles: (libraryId) => ipcRenderer.invoke('v2:book:importFiles', { libraryId }),
  bookRename: (libraryId, bookId, displayTitle) => ipcRenderer.invoke('v2:book:rename', { libraryId, bookId, displayTitle }),
  bookRemove: (libraryId, bookId) => ipcRenderer.invoke('v2:book:remove', { libraryId, bookId }),
  bookRelinkFile: (libraryId, bookId) => ipcRenderer.invoke('v2:book:relinkFile', { libraryId, bookId }),

  readerOpenBook: (libraryId, bookId) => ipcRenderer.invoke('v2:reader:openBook', { libraryId, bookId }),
  progressDoc: (libraryId) => ipcRenderer.invoke('v2:progress:doc', { libraryId }),
  progressGet: (libraryId, bookId) => ipcRenderer.invoke('v2:progress:get', { libraryId, bookId }),
  progressSave: (libraryId, bookId, scrollRatio) => ipcRenderer.invoke('v2:progress:save', { libraryId, bookId, scrollRatio })
});
