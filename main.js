const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// 尝试加载 iconv-lite 和 jschardet，如果失败则降级处理
let iconv, jschardet;
try {
  iconv = require('iconv-lite');
  jschardet = require('jschardet');
} catch (e) {
  console.log('Optional dependencies missing, using basic encoding support');
}

let mainWindow;
let previousBounds = null;

// --- Helper Functions ---

function decodeText(buffer) {
  // 如果没有 iconv-lite，直接返回 utf8
  if (!iconv || !jschardet) {
    return { content: buffer.toString('utf8'), encoding: 'utf8 (fallback)' };
  }

  // BOM Detection
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { content: iconv.decode(buffer.slice(3), 'utf8'), encoding: 'utf8' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { content: iconv.decode(buffer.slice(2), 'utf16le'), encoding: 'utf16le' };
  }

  // Jschardet Detection
  const detected = jschardet.detect(buffer);
  let encoding = detected && detected.encoding ? detected.encoding : 'utf8';
  
  // GBK/GB2312/GB18030 Mapping
  if (['GB2312', 'GBK'].includes(encoding.toUpperCase())) {
    encoding = 'GB18030';
  }

  try {
    const content = iconv.decode(buffer, encoding);
    return { content, encoding };
  } catch (e) {
    return { content: buffer.toString('utf8'), encoding: 'utf8-error' };
  }
}

// --- Window Management ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false 
    },
    icon: path.join(__dirname, 'icon.png') // If exists
  });

  mainWindow.loadFile('index.html');

  setupWindowEvents();

  // Open DevTools in dev environment (optional)
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

// Window Controls
ipcMain.on('window-control', (event, action, payload) => {
  if (!mainWindow) return;
  switch (action) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        // Explicitly store bounds before maximizing
        // This ensures we have the latest correct non-maximized bounds
        previousBounds = mainWindow.getBounds();
        mainWindow.maximize();
      }
      break;
    case 'unmaximize':
      // Attempt to restore from native unmaximize first
      mainWindow.unmaximize();
      // Then, if we have a recorded previousBounds, apply them after a short delay
      if (previousBounds) {
        setTimeout(() => {
          // Only apply if the window is indeed not maximized anymore
          if (mainWindow && !mainWindow.isMaximized()) {
            mainWindow.setBounds(previousBounds);
          }
        }, 50);
      }
      break;
    case 'close':
      mainWindow.close();
      break;
    case 'set-always-on-top':
      mainWindow.setAlwaysOnTop(!!payload);
      break;
    case 'set-opacity':
      // Payload expected: 0.1 to 1.0
      mainWindow.setOpacity(payload);
      break;
    case 'resize':
      // Payload: { x, y, width, height }
      if (mainWindow) {
          mainWindow.setBounds(payload);
      }
      break;
    case 'get-bounds':
      event.returnValue = mainWindow.getBounds();
      break;
  }
});

// Watch for max/unmax events to sync state
function setupWindowEvents() {
    if (!mainWindow) return;
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-state-changed', 'maximized');
    });
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-state-changed', 'normal');
        // Ensure restore to exact previous non-maximized bounds for frameless windows
        if (previousBounds) {
            setTimeout(() => {
                if (mainWindow && !mainWindow.isMaximized()) {
                    mainWindow.setBounds(previousBounds);
                }
            }, 50);
        }
    });

    // Track bounds for manual restore
    mainWindow.on('resize', () => {
        if (!mainWindow.isMaximized() && !mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
            previousBounds = mainWindow.getBounds();
        }
    });

    mainWindow.on('move', () => {
        if (!mainWindow.isMaximized() && !mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
            previousBounds = mainWindow.getBounds();
        }
    });
}

// Async handler for getting bounds if preferred (though sync is often easier for UI, 
// but IPC sync is blocking. Let's use invoke/handle for async 'get-bounds' is better pattern?)
// Actually, let's add a separate handle for it to be clean.

ipcMain.handle('get-window-bounds', () => {
  if (mainWindow) return mainWindow.getBounds();
  return null;
});

// File Operations
ipcMain.handle('file-open-dialog', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Books', extensions: ['txt', 'log', 'md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('file-read', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const { content, encoding } = decodeText(buffer);
    const stats = fs.statSync(filePath);
    return { 
      success: true, 
      content, 
      encoding,
      fileName: path.basename(filePath),
      filePath: filePath,
      size: stats.size
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Data Persistence (Simple JSON in UserData)
const DATA_FILE = path.join(app.getPath('userData'), 'fishing-book-v2.1.json');

ipcMain.handle('data-save', async (event, data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('data-load', async () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return { success: true, data };
    }
    return { success: true, data: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
