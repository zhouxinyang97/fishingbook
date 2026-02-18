const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

function getV2FilePath(fileName) {
  return path.join(app.getPath('userData'), fileName);
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return fallback;
    return data;
  } catch (_) {
    try {
      const bak = `${filePath}.bak`;
      if (!fs.existsSync(bak)) return fallback;
      const raw = fs.readFileSync(bak, 'utf8');
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return fallback;
      return data;
    } catch (_) {
      return fallback;
    }
  }
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const bak = `${filePath}.bak`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    if (fs.existsSync(filePath)) {
      try {
        if (fs.existsSync(bak)) fs.unlinkSync(bak);
      } catch (_) {}
      try {
        fs.renameSync(filePath, bak);
      } catch (_) {}
    }
    fs.renameSync(tmp, filePath);
    try {
      if (fs.existsSync(bak)) fs.unlinkSync(bak);
    } catch (_) {}
    return true;
  } catch (_) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (_) {}
    return false;
  }
}

function makeLibraryId() {
  return `lib_${crypto.randomBytes(2).toString('hex')}${Date.now().toString(16).slice(-4)}`;
}

function stableBookId(filePath) {
  const h = crypto.createHash('sha1').update(String(filePath)).digest('hex').slice(0, 8);
  return `book_${h}`;
}

function getLibrariesPath() {
  return getV2FilePath('libraries.v2.0.json');
}

function getSettingsPath() {
  return getV2FilePath('settings.v2.0.json');
}

function getBooksPath(libraryId) {
  return getV2FilePath(`books.${libraryId}.v2.0.json`);
}

function getProgressPath(libraryId) {
  return getV2FilePath(`progress.${libraryId}.v2.0.json`);
}

function normalizeSettingsDoc(doc) {
  const d = doc && typeof doc === 'object' ? { ...doc } : {};
  d.schemaVersion = '2.0';
  if (typeof d.autoOpenLastLibrary !== 'boolean') d.autoOpenLastLibrary = true;
  d.appearance = d.appearance && typeof d.appearance === 'object' ? { ...d.appearance } : {};
  const op = Number(d.appearance.globalOpacity);
  d.appearance.globalOpacity = Number.isFinite(op) ? Math.max(0.65, Math.min(1.0, op)) : 0.92;
  if (typeof d.appearance.theme !== 'string' || d.appearance.theme.length === 0) d.appearance.theme = 'teal';
  return d;
}

function readSettings() {
  return normalizeSettingsDoc(readJsonSafe(getSettingsPath(), null));
}

function writeSettings(patch) {
  const prev = readSettings();
  const next = normalizeSettingsDoc({ ...prev, ...(patch && typeof patch === 'object' ? patch : {}) });
  const ok = writeJsonAtomic(getSettingsPath(), next);
  return { ok, data: next };
}

function readLibraries() {
  const fallback = { schemaVersion: '2.0', activeLibraryId: null, libraries: [] };
  const doc = readJsonSafe(getLibrariesPath(), fallback);
  if (doc && doc.schemaVersion !== '2.0') doc.schemaVersion = '2.0';
  if (!Array.isArray(doc.libraries)) doc.libraries = [];
  if (doc.activeLibraryId != null && typeof doc.activeLibraryId !== 'string') doc.activeLibraryId = null;
  return doc;
}

function writeLibraries(doc) {
  return writeJsonAtomic(getLibrariesPath(), { ...doc, schemaVersion: '2.0' });
}

function readBooks(libraryId) {
  const fallback = { schemaVersion: '2.0', libraryId, books: [] };
  const doc = readJsonSafe(getBooksPath(libraryId), fallback);
  if (!Array.isArray(doc.books)) doc.books = [];
  doc.schemaVersion = '2.0';
  doc.libraryId = libraryId;
  return doc;
}

function writeBooks(libraryId, doc) {
  return writeJsonAtomic(getBooksPath(libraryId), { ...doc, schemaVersion: '2.0', libraryId });
}

function readProgress(libraryId) {
  const fallback = { schemaVersion: '2.0', libraryId, progressByBookId: {}, lastReadBookId: null };
  const doc = readJsonSafe(getProgressPath(libraryId), fallback);
  if (!doc.progressByBookId || typeof doc.progressByBookId !== 'object') doc.progressByBookId = {};
  doc.schemaVersion = '2.0';
  doc.libraryId = libraryId;
  if (doc.lastReadBookId != null && typeof doc.lastReadBookId !== 'string') doc.lastReadBookId = null;
  return doc;
}

function writeProgress(libraryId, doc) {
  return writeJsonAtomic(getProgressPath(libraryId), { ...doc, schemaVersion: '2.0', libraryId });
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

  mainWindow.loadFile(path.join(__dirname, 'version', 'v2.0', 'ui', 'library-picker.html'));

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

ipcMain.handle('v2:settings:get', async () => {
  try {
    const data = readSettings();
    if (!fs.existsSync(getSettingsPath())) writeJsonAtomic(getSettingsPath(), data);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:settings:update', async (event, patch) => {
  try {
    const { ok, data } = writeSettings(patch);
    return { success: ok, data, error: ok ? undefined : 'write-failed' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:library:list', async () => {
  try {
    const data = readLibraries();
    const settings = readSettings();
    return { success: true, data: { ...data, settings } };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:library:chooseFolderAndAdd', async () => {
  try {
    if (!mainWindow) return { success: false, error: 'no-window' };
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false, canceled: true };
    const folderPath = result.filePaths[0];

    const libs = readLibraries();
    const now = Date.now();
    const existing = libs.libraries.find((l) => l.path === folderPath);
    if (existing) {
      existing.lastOpenedAt = now;
      libs.activeLibraryId = existing.id;
      writeLibraries(libs);
      return { success: true, library: existing };
    }

    const id = makeLibraryId();
    const name = path.basename(folderPath);
    const lib = { id, name, path: folderPath, createdAt: now, lastOpenedAt: now };
    libs.libraries.unshift(lib);
    libs.activeLibraryId = id;
    writeLibraries(libs);
    return { success: true, library: lib };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:library:setActive', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    if (!libraryId) return { success: false, error: 'bad-request' };
    const libs = readLibraries();
    const lib = libs.libraries.find((l) => l.id === libraryId);
    if (!lib) return { success: false, error: 'not-found' };
    lib.lastOpenedAt = Date.now();
    libs.activeLibraryId = libraryId;
    writeLibraries(libs);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:library:remove', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    if (!libraryId) return { success: false, error: 'bad-request' };
    const libs = readLibraries();
    libs.libraries = libs.libraries.filter((l) => l.id !== libraryId);
    if (libs.activeLibraryId === libraryId) libs.activeLibraryId = libs.libraries[0] ? libs.libraries[0].id : null;
    writeLibraries(libs);
    try {
      const bp = getBooksPath(libraryId);
      if (fs.existsSync(bp)) fs.unlinkSync(bp);
      const pp = getProgressPath(libraryId);
      if (fs.existsSync(pp)) fs.unlinkSync(pp);
    } catch (_) {}
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:book:list', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    if (!libraryId) return { success: false, error: 'bad-request' };
    const doc = readBooks(libraryId);
    const books = doc.books.map((b) => {
      const exists = b && typeof b.filePath === 'string' ? fs.existsSync(b.filePath) : false;
      return { ...b, missing: !exists };
    });
    return { success: true, books };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:book:importFiles', async (event, req) => {
  try {
    if (!mainWindow) return { success: false, error: 'no-window' };
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    if (!libraryId) return { success: false, error: 'bad-request' };

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Text', extensions: ['txt', 'log', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false, canceled: true };

    const doc = readBooks(libraryId);
    const now = Date.now();
    const exists = new Set(doc.books.map((b) => b.filePath));
    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const added = [];
    const dup = [];
    const failed = [];
    const session = readSession();

    for (const fp of result.filePaths) {
      if (exists.has(fp)) {
        skippedCount++;
        dup.push({ filePath: fp, displayTitle: path.basename(fp, path.extname(fp)) });
        continue;
      }
      try {
        const st = fs.statSync(fp);
        const bookId = stableBookId(fp);
        const displayTitle = path.basename(fp, path.extname(fp));
        const book = {
          id: bookId,
          displayTitle,
          filePath: fp,
          addedAt: now,
          lastOpenedAt: null,
          fileStat: { size: st.size, mtimeMs: st.mtimeMs }
        };
        doc.books.unshift(book);
        exists.add(fp);
        importedCount++;
        added.push(book);

        if (session && session.lastFilePath === fp && typeof session.lastScrollRatio === 'number') {
          const p = readProgress(libraryId);
          if (!p.progressByBookId[bookId]) {
            p.progressByBookId[bookId] = { scrollRatio: Math.max(0, Math.min(1, session.lastScrollRatio)), updatedAt: Date.now() };
            p.lastReadBookId = bookId;
            writeProgress(libraryId, p);
          }
        }
      } catch (e) {
        errors.push({ filePath: fp, error: e.message });
        failed.push({ filePath: fp, displayTitle: path.basename(fp, path.extname(fp)), reason: e.message });
      }
    }

    writeBooks(libraryId, doc);
    return { success: true, importedCount, skippedCount, errors, added, dup, failed };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:book:rename', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    const bookId = req && typeof req.bookId === 'string' ? req.bookId : null;
    const displayTitle = req && typeof req.displayTitle === 'string' ? req.displayTitle : null;
    if (!libraryId || !bookId || displayTitle == null) return { success: false, error: 'bad-request' };
    const doc = readBooks(libraryId);
    const b = doc.books.find((x) => x.id === bookId);
    if (!b) return { success: false, error: 'not-found' };
    b.displayTitle = displayTitle;
    writeBooks(libraryId, doc);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:book:remove', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    const bookId = req && typeof req.bookId === 'string' ? req.bookId : null;
    if (!libraryId || !bookId) return { success: false, error: 'bad-request' };
    const doc = readBooks(libraryId);
    doc.books = doc.books.filter((b) => b.id !== bookId);
    writeBooks(libraryId, doc);
    const p = readProgress(libraryId);
    if (p.progressByBookId && p.progressByBookId[bookId]) delete p.progressByBookId[bookId];
    if (p.lastReadBookId === bookId) p.lastReadBookId = null;
    writeProgress(libraryId, p);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:book:relinkFile', async (event, req) => {
  try {
    if (!mainWindow) return { success: false, error: 'no-window' };
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    const bookId = req && typeof req.bookId === 'string' ? req.bookId : null;
    if (!libraryId || !bookId) return { success: false, error: 'bad-request' };
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false, canceled: true };
    const fp = result.filePaths[0];
    const st = fs.statSync(fp);
    const doc = readBooks(libraryId);
    const b = doc.books.find((x) => x.id === bookId);
    if (!b) return { success: false, error: 'not-found' };
    b.filePath = fp;
    b.fileStat = { size: st.size, mtimeMs: st.mtimeMs };
    writeBooks(libraryId, doc);
    return { success: true, filePath: fp };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:reader:openBook', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    const bookId = req && typeof req.bookId === 'string' ? req.bookId : null;
    if (!libraryId || !bookId) return { success: false, error: 'bad-request' };
    const doc = readBooks(libraryId);
    const b = doc.books.find((x) => x.id === bookId);
    if (!b) return { success: false, error: 'not-found' };
    if (!b.filePath || !fs.existsSync(b.filePath)) return { success: false, error: 'file-missing' };
    const buffer = fs.readFileSync(b.filePath);
    const { content, encoding } = decodeText(buffer);

    b.lastOpenedAt = Date.now();
    writeBooks(libraryId, doc);

    const p = readProgress(libraryId);
    const progress = p.progressByBookId && p.progressByBookId[bookId] ? p.progressByBookId[bookId] : null;
    p.lastReadBookId = bookId;
    writeProgress(libraryId, p);

    return { success: true, fileName: path.basename(b.filePath), filePath: b.filePath, content, encoding, progress };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:progress:doc', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    if (!libraryId) return { success: false, error: 'bad-request' };
    const data = readProgress(libraryId);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:progress:get', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    const bookId = req && typeof req.bookId === 'string' ? req.bookId : null;
    if (!libraryId || !bookId) return { success: false, error: 'bad-request' };
    const p = readProgress(libraryId);
    const progress = p.progressByBookId && p.progressByBookId[bookId] ? p.progressByBookId[bookId] : null;
    return { success: true, progress };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('v2:progress:save', async (event, req) => {
  try {
    const libraryId = req && typeof req.libraryId === 'string' ? req.libraryId : null;
    const bookId = req && typeof req.bookId === 'string' ? req.bookId : null;
    const scrollRatio = req && typeof req.scrollRatio === 'number' ? req.scrollRatio : null;
    if (!libraryId || !bookId || scrollRatio == null || !Number.isFinite(scrollRatio)) return { success: false, error: 'bad-request' };
    const p = readProgress(libraryId);
    p.progressByBookId = p.progressByBookId || {};
    p.progressByBookId[bookId] = { scrollRatio: Math.max(0, Math.min(1, scrollRatio)), updatedAt: Date.now() };
    p.lastReadBookId = bookId;
    const ok = writeProgress(libraryId, p);
    return { success: ok };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
