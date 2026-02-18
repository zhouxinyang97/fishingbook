const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

let mainWindow;

function getSessionFilePath() {
  return path.join(app.getPath('userData'), 'session.json');
}

function readSession() {
  try {
    const p = getSessionFilePath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (_) {
    return null;
  }
}

function writeSession(patch) {
  try {
    const prev = readSession() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    fs.writeFileSync(getSessionFilePath(), JSON.stringify(next));
    return true;
  } catch (_) {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false, // No border
    transparent: true, // Transparent background support
    backgroundColor: '#00000000', // Start fully transparent
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow loading local files
    },
    alwaysOnTop: false,
    skipTaskbar: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-state-change', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state-change', 'normal'));

  // Open DevTools for debugging (can be removed in production)
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();

  // Boss Key: Alt+H to toggle visibility
  globalShortcut.register('Alt+H', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // Alt+Up/Down for opacity control (optional, can be done in renderer too)
  // But requirement says UI slider, so we focus on that first.

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// IPC handlers
function decodeText(buffer) {
  const hasUtf8Bom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const hasUtf16LeBom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const hasUtf16BeBom = buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;

  const stripBom = (buf, n) => buf.slice(n);

  const scoreText = (str) => {
    const sampleLen = Math.min(str.length, 200_000);
    if (sampleLen === 0) return -1e9;
    let replacement = 0;
    let cjk = 0;
    let control = 0;
    for (let i = 0; i < sampleLen; i++) {
      const code = str.charCodeAt(i);
      if (code === 0xfffd) {
        replacement++;
      } else if (code >= 0x4e00 && code <= 0x9fff) {
        cjk++;
      } else if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
        control++;
      }
    }
    const len = sampleLen;
    return (cjk / len) * 6 - (replacement / len) * 20 - (control / len) * 4;
  };

  if (hasUtf8Bom) {
    const content = iconv.decode(stripBom(buffer, 3), 'utf8');
    return { content, encoding: 'utf8' };
  }
  if (hasUtf16LeBom) {
    const content = iconv.decode(stripBom(buffer, 2), 'utf16le');
    return { content, encoding: 'utf16le' };
  }
  if (hasUtf16BeBom) {
    const content = iconv.decode(stripBom(buffer, 2), 'utf16-be');
    return { content, encoding: 'utf16-be' };
  }

  const nullCount = buffer.reduce((acc, b) => acc + (b === 0x00 ? 1 : 0), 0);
  const nullRatio = nullCount / Math.max(buffer.length, 1);
  const likelyUtf16 = nullRatio > 0.1;

  const candidates = [
    { enc: 'utf8', buf: buffer },
    { enc: 'gb18030', buf: buffer },
    { enc: 'gbk', buf: buffer },
    { enc: 'big5', buf: buffer }
  ];

  if (likelyUtf16) {
    candidates.push({ enc: 'utf16le', buf: buffer });
    candidates.push({ enc: 'utf16-be', buf: buffer });
  }

  const detected = jschardet.detect(buffer);
  if (detected && detected.encoding && iconv.encodingExists(detected.encoding)) {
    const enc = detected.encoding === 'GB2312' ? 'gbk' : detected.encoding;
    if (!candidates.some((c) => c.enc.toLowerCase() === String(enc).toLowerCase())) {
      candidates.push({ enc, buf: buffer });
    }
  }

  let best = null;
  for (const c of candidates) {
    try {
      const content = iconv.decode(c.buf, c.enc);
      const s = scoreText(content);
      if (!best || s > best.score) {
        best = { content, encoding: c.enc, score: s };
      }
    } catch (_) {}
  }

  if (best) return { content: best.content, encoding: best.encoding };
  return { content: buffer.toString('utf8'), encoding: 'utf8' };
}

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const { content, encoding } = decodeText(buffer);
    return { success: true, content, encoding };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file', async () => {
  if (!mainWindow) return { success: false, error: 'no-window' };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text', extensions: ['txt', 'log', 'md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  const filePath = result.filePaths[0];
  try {
    const buffer = fs.readFileSync(filePath);
    const { content, encoding } = decodeText(buffer);
    writeSession({ lastFilePath: filePath, lastScrollRatio: 0 });
    return { success: true, fileName: path.basename(filePath), filePath, content, encoding };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-last-session', async () => {
  try {
    const session = readSession();
    if (!session || !session.lastFilePath) return { success: false };
    const filePath = session.lastFilePath;
    if (!fs.existsSync(filePath)) return { success: false };
    const buffer = fs.readFileSync(filePath);
    const { content, encoding } = decodeText(buffer);
    return {
      success: true,
      fileName: path.basename(filePath),
      filePath,
      content,
      encoding,
      scrollRatio: typeof session.lastScrollRatio === 'number' ? session.lastScrollRatio : 0
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.on('save-session', (event, patch) => {
  if (!patch || typeof patch !== 'object') return;
  const next = {};
  if (typeof patch.filePath === 'string' && patch.filePath.length > 0) next.lastFilePath = patch.filePath;
  if (typeof patch.scrollRatio === 'number' && Number.isFinite(patch.scrollRatio)) next.lastScrollRatio = patch.scrollRatio;
  if (Object.keys(next).length === 0) return;
  writeSession(next);
});

ipcMain.on('set-opacity', (event, opacity) => {
  // opacity is 0.0 to 1.0
  // Note: on Windows, setOpacity might affect the whole window including text.
  // Ideally, we control background color alpha in CSS, but for the whole window transparency:
  // mainWindow.setOpacity(opacity); 
  // But the requirement says "transparent background feature", which usually means
  // the window background is transparent but text is opaque?
  // If we want "glass" effect or just see-through background, CSS opacity is better if the window itself is 'transparent: true'.
  // However, `setOpacity` makes the whole window (including text) semi-transparent.
  // The PRD says "Background color and transparency independent adjustment".
  // So we probably handle background color in CSS, and window opacity via setOpacity if needed.
  // But if the user wants to adjust "window transparency", usually it implies the whole window.
  // Let's implement setOpacity for the whole window for now as a fallback or option.
  if (mainWindow) {
    mainWindow.setOpacity(opacity);
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  if (mainWindow) {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('toggle-always-on-top', (event, flag) => {
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(flag);
    }
});

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('resize-window', (event, bounds) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const current = win.getBounds();
        if (current.x === bounds.x && current.y === bounds.y && current.width === bounds.width && current.height === bounds.height) return;
        win.setBounds(bounds, false);
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});
