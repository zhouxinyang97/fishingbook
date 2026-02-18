/* Fishing Book v2.0 - HTML Prototype Runtime (no external dependencies)
   - Uses localStorage to simulate v2.0 JSON persistence (libraries/books/progress)
   - Supports state switch via query param: ?state=default|loading|empty|error
   - Optional debug UI: ?debug=1
*/

(function(){
  const FB = {};

  // ---------- utils ----------
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function isElectron(){
    return !!(window.electronAPI && typeof window.electronAPI === "object");
  }

  function formatTime(ts){
    try{
      const d = new Date(ts);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    }catch(e){ return "—"; }
  }

  function uid(prefix){
    return `${prefix}_${Math.random().toString(16).slice(2,8)}${Date.now().toString(16).slice(-4)}`;
  }

  function parseParams(){
    const u = new URL(location.href);
    return u.searchParams;
  }

  function setParam(key, value){
    const u = new URL(location.href);
    if(value === null || value === undefined) u.searchParams.delete(key);
    else u.searchParams.set(key, value);
    history.replaceState(null, "", u.toString());
  }

  // ---------- storage ----------
  const K = {
    libs: "fb_v2_libraries",
    activeLib: "fb_v2_activeLibraryId",
    // legacy (kept for backward compatibility with earlier prototype pages)
    settings: "fb_v2_settings",
    // PRD naming: simulate settings.v2.0.json in localStorage
    settingsJson: "settings.v2.0.json",
    books: (libId)=>`fb_v2_books_${libId}`,
    progress: (libId)=>`fb_v2_progress_${libId}`,
  };

  function readJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  }
  function writeJSON(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---------- settings (v2.0 json) ----------
  const THEMES = {
    teal:   { label:"青绿",  accent:[94,234,212],  accent2:[96,165,250] },
    blue:   { label:"蓝色",  accent:[96,165,250],  accent2:[56,189,248] },
    violet: { label:"紫色",  accent:[167,139,250], accent2:[244,114,182] },
    amber:  { label:"琥珀",  accent:[251,191,36],  accent2:[34,211,238] },
    rose:   { label:"玫红",  accent:[251,113,133], accent2:[167,139,250] },
  };

  const DEFAULT_SETTINGS = {
    schemaVersion: "2.0",
    autoOpenLastLibrary: true,
    appearance: {
      globalOpacity: 0.92,
      theme: "teal",
    }
  };

  function normalizeSettingsDoc(doc){
    const d = { ...(doc||{}) };
    d.schemaVersion = "2.0";
    d.autoOpenLastLibrary = (d.autoOpenLastLibrary === undefined)
      ? DEFAULT_SETTINGS.autoOpenLastLibrary
      : !!d.autoOpenLastLibrary;

    d.appearance = { ...(DEFAULT_SETTINGS.appearance), ...(d.appearance||{}) };
    const op = Number(d.appearance.globalOpacity);
    d.appearance.globalOpacity = Number.isFinite(op) ? clamp(op, 0.65, 1.0) : DEFAULT_SETTINGS.appearance.globalOpacity;
    d.appearance.theme = THEMES[d.appearance.theme] ? d.appearance.theme : DEFAULT_SETTINGS.appearance.theme;
    return d;
  }

  function writeSettings(doc){
    const normalized = normalizeSettingsDoc(doc);
    writeJSON(K.settingsJson, normalized);
    // keep legacy key minimal, so older prototype bits still read what they expect
    writeJSON(K.settings, { autoOpenLastLibrary: normalized.autoOpenLastLibrary });
    return normalized;
  }

  function getSettings(){
    const fromJson = readJSON(K.settingsJson, null);
    const legacy = readJSON(K.settings, null);
    const merged = { ...(fromJson||{}) };
    if(legacy && typeof legacy.autoOpenLastLibrary === "boolean" && merged.autoOpenLastLibrary === undefined){
      merged.autoOpenLastLibrary = legacy.autoOpenLastLibrary;
    }
    const doc = normalizeSettingsDoc(merged);
    // migrate once if needed
    if(!fromJson) writeSettings(doc);
    return doc;
  }

  function applyAppearance(appearance){
    const a = { ...(DEFAULT_SETTINGS.appearance), ...(appearance||{}) };
    const theme = THEMES[a.theme] || THEMES[DEFAULT_SETTINGS.appearance.theme];
    const op = clamp(Number(a.globalOpacity) || DEFAULT_SETTINGS.appearance.globalOpacity, 0.65, 1.0);

    const root = document.documentElement;
    root.style.setProperty("--accent-rgb", theme.accent.join(" "));
    root.style.setProperty("--accent2-rgb", theme.accent2.join(" "));
    root.setAttribute("data-theme", a.theme);

    // derive alpha family from one knob (globalOpacity)
    root.style.setProperty("--glass", op.toFixed(2));
    root.style.setProperty("--glass-2", Math.max(0.35, op - 0.04).toFixed(2));
    root.style.setProperty("--glass-3", Math.max(0.28, op - 0.14).toFixed(2));
    root.style.setProperty("--glass-input", Math.max(0.22, op - 0.34).toFixed(2));
    root.style.setProperty("--glass-toast", Math.min(0.92, op + 0.06).toFixed(2));
  }

  function setAppearance(patch){
    const doc = getSettings();
    doc.appearance = { ...(doc.appearance||{}), ...(patch||{}) };
    const saved = writeSettings(doc);
    applyAppearance(saved.appearance);
    return saved.appearance;
  }

  function resetAppearance(){
    const doc = getSettings();
    doc.appearance = { ...(DEFAULT_SETTINGS.appearance) };
    const saved = writeSettings(doc);
    applyAppearance(saved.appearance);
    return saved.appearance;
  }

  function initAppearance(){
    applyAppearance(getSettings().appearance);
  }

  // ---------- window drag/resize simulation (prototype only) ----------
  function initSimWindow(){
    qsa(".window.sim-window").forEach(win=>{
      const bar = qs(".window-bar", win);
      if(!bar) return;

      // ensure overlay exists even if page forgot to include it
      if(!qs(".resize-overlay", win)){
        const ov = document.createElement("div");
        ov.className = "resize-overlay";
        ov.setAttribute("aria-hidden", "true");
        ov.innerHTML = `<div class="resize-overlay-card">缩放中，松开后恢复渲染 <span class="resize-overlay-meta" data-resize-meta></span></div>`;
        win.appendChild(ov);
      }
      const overlayMeta = qs("[data-resize-meta]", win);

      // initial position (center-ish). If already positioned by page, don't override.
      const hasLeftTop = (win.style.left && win.style.top);
      if(!hasLeftTop){
        const r = win.getBoundingClientRect();
        const left = Math.round((window.innerWidth - r.width) / 2);
        const top = Math.round((window.innerHeight - r.height) / 2);
        win.style.left = `${Math.max(12, left)}px`;
        win.style.top = `${Math.max(12, top)}px`;
        win.style.transform = "none";
      }

      // drag on title bar blank area
      let dragging = false;
      let startX = 0, startY = 0;
      let startLeft = 0, startTop = 0;

      function endDrag(){
        if(!dragging) return;
        dragging = false;
        win.classList.remove("is-dragging");
      }

      bar.addEventListener("pointerdown", (e)=>{
        if(e.button !== 0) return;
        if(e.target.closest("button,a,input,select,textarea,label")) return;
        dragging = true;
        win.classList.add("is-dragging");
        const rect = win.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        try{ bar.setPointerCapture(e.pointerId); }catch(_e){}
        e.preventDefault();
      });
      bar.addEventListener("pointermove", (e)=>{
        if(!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let left = startLeft + dx;
        let top = startTop + dy;

        const maxLeft = window.innerWidth - win.offsetWidth - 8;
        const maxTop = window.innerHeight - win.offsetHeight - 8;
        left = clamp(left, 8, Math.max(8, maxLeft));
        top = clamp(top, 8, Math.max(8, maxTop));

        win.style.left = `${Math.round(left)}px`;
        win.style.top = `${Math.round(top)}px`;
      });
      bar.addEventListener("pointerup", endDrag);
      bar.addEventListener("pointercancel", endDrag);
      window.addEventListener("blur", endDrag);

      // resize overlay (debounced hide)
      let hideTimer = null;
      const ro = new ResizeObserver((entries)=>{
        for(const ent of entries){
          win.classList.add("is-resizing");
          if(overlayMeta){
            const cr = ent.contentRect;
            overlayMeta.textContent = `${Math.round(cr.width)}×${Math.round(cr.height)}`;
          }
          clearTimeout(hideTimer);
          hideTimer = setTimeout(()=> win.classList.remove("is-resizing"), 220);
        }
      });
      ro.observe(win);
    });
  }

  function initNativeMode(){
    if(!isElectron()) return;
    document.body.classList.add("native");
    document.documentElement.classList.add("native");
    qsa(".window.sim-window").forEach(win=>{
      win.classList.remove("sim-window");
      win.style.left = "";
      win.style.top = "";
      win.style.transform = "";
    });
  }

  function initNativeResize(){
    if(!isElectron()) return;
    if(typeof window.electronAPI.resizeWindow !== "function") return;
    if(qs(".native-resizer")) return;

    const parts = ["tl","t","tr","r","br","b","bl","l"];
    parts.forEach(p=>{
      const el = document.createElement("div");
      el.className = `native-resizer ${p}`;
      el.setAttribute("data-native-resizer", p);
      document.body.appendChild(el);
    });

    let isResizing = false;
    let dir = null;
    let startX = 0, startY = 0;
    let startW = 0, startH = 0;
    let startLeft = 0, startTop = 0;
    let pending = null;
    let raf = null;
    let lastSent = null;
    let lastSentAt = 0;

    function boundsEqual(a,b){
      if(!a || !b) return false;
      return a.x===b.x && a.y===b.y && a.width===b.width && a.height===b.height;
    }

    function tick(){
      raf = null;
      if(!isResizing) return;
      if(pending){
        const now = performance.now();
        if(now - lastSentAt >= 33 && !boundsEqual(pending, lastSent)){
          window.electronAPI.resizeWindow(pending);
          lastSent = pending;
          lastSentAt = now;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    function schedule(){
      if(raf != null) return;
      raf = requestAnimationFrame(tick);
    }

    function onMove(e){
      if(!isResizing) return;
      const dx = e.screenX - startX;
      const dy = e.screenY - startY;
      let newW = startW;
      let newH = startH;
      let newX = startLeft;
      let newY = startTop;

      const minW = 360;
      const minH = 240;

      if(dir === "r"){ newW = startW + dx; }
      else if(dir === "l"){ newW = startW - dx; newX = startLeft + dx; }
      else if(dir === "b"){ newH = startH + dy; }
      else if(dir === "t"){ newH = startH - dy; newY = startTop + dy; }
      else if(dir === "br"){ newW = startW + dx; newH = startH + dy; }
      else if(dir === "bl"){ newW = startW - dx; newH = startH + dy; newX = startLeft + dx; }
      else if(dir === "tr"){ newW = startW + dx; newH = startH - dy; newY = startTop + dy; }
      else if(dir === "tl"){ newW = startW - dx; newH = startH - dy; newX = startLeft + dx; newY = startTop + dy; }

      if(newW < minW){
        if(dir === "l" || dir === "bl" || dir === "tl") newX -= (minW - newW);
        newW = minW;
      }
      if(newH < minH){
        if(dir === "t" || dir === "tr" || dir === "tl") newY -= (minH - newH);
        newH = minH;
      }

      pending = { x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) };
      schedule();
      document.body.classList.add("is-resizing");
    }

    function onUp(){
      if(!isResizing) return;
      isResizing = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if(pending && !boundsEqual(pending, lastSent)) window.electronAPI.resizeWindow(pending);
      pending = null;
      document.body.classList.remove("is-resizing");
      if(raf != null){
        cancelAnimationFrame(raf);
        raf = null;
      }
    }

    qsa("[data-native-resizer]").forEach(el=>{
      el.addEventListener("mousedown", (e)=>{
        if(e.button !== 0) return;
        isResizing = true;
        dir = el.getAttribute("data-native-resizer");
        startX = e.screenX; startY = e.screenY;
        startW = window.outerWidth;
        startH = window.outerHeight;
        startLeft = window.screenX;
        startTop = window.screenY;
        lastSent = null;
        lastSentAt = 0;
        pending = null;
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        e.preventDefault();
      });
    });
  }

  function seed(){
    const libs = readJSON(K.libs, null);
    if(libs && Array.isArray(libs.libraries) && libs.libraries.length) return;

    const now = Date.now();
    const lib1 = { id:"lib_9b8c", name:"个人小说库", path:"D:\\\\Books\\\\Novels", lastOpenedAt: now - 1000*60*60*24*3 };
    const lib2 = { id:"lib_1d2e", name:"工作资料库", path:"D:\\\\Docs\\\\Specs", lastOpenedAt: now - 1000*60*60*24*20 };
    const libBad = { id:"lib_dead", name:"旧备份（失效）", path:"D:\\\\Missing\\\\Library", lastOpenedAt: now - 1000*60*60*24*120, invalidReason:"路径不存在或无权限" };

    writeJSON(K.libs, {
      schemaVersion:"2.0",
      activeLibraryId: lib1.id,
      libraries: [lib1, lib2, libBad]
    });
    localStorage.setItem(K.activeLib, lib1.id);
    writeSettings({ autoOpenLastLibrary: true });

    const books1 = {
      schemaVersion:"2.0",
      libraryId: lib1.id,
      books: [
        {
          id:"book_shediao",
          displayTitle:"射雕英雄传",
          filePath:"D:\\\\Books\\\\Novels\\\\射雕英雄传.txt",
          addedAt: now - 1000*60*60*24*40,
          lastOpenedAt: now - 1000*60*18,
          fileStat:{ size: 1234567, mtimeMs: now - 1000*60*60*24*17 },
          missing:false
        },
        {
          id:"book_nifeng",
          displayTitle:"逆风飞扬",
          filePath:"D:\\\\Books\\\\Novels\\\\逆风飞扬.txt",
          addedAt: now - 1000*60*60*24*80,
          lastOpenedAt: now - 1000*60*60*24*9,
          fileStat:{ size: 854321, mtimeMs: now - 1000*60*60*24*67 },
          missing:false
        },
        {
          id:"book_yudafu",
          displayTitle:"郁达夫诗全集（文件缺失）",
          filePath:"D:\\\\Books\\\\Novels\\\\郁达夫诗全集.txt",
          addedAt: now - 1000*60*60*24*200,
          lastOpenedAt: now - 1000*60*60*24*90,
          fileStat:{ size: 234567, mtimeMs: now - 1000*60*60*24*105 },
          missing:true
        }
      ]
    };
    writeJSON(K.books(lib1.id), books1);
    writeJSON(K.progress(lib1.id), {
      schemaVersion:"2.0",
      libraryId: lib1.id,
      progressByBookId:{
        "book_shediao": { scrollRatio: 0.42, updatedAt: now - 1000*60*10 },
        "book_nifeng": { scrollRatio: 0.08, updatedAt: now - 1000*60*60*8 },
      },
      lastReadBookId: "book_shediao"
    });

    // empty second library for empty-state demo
    writeJSON(K.books(lib2.id), { schemaVersion:"2.0", libraryId: lib2.id, books: [] });
    writeJSON(K.progress(lib2.id), { schemaVersion:"2.0", libraryId: lib2.id, progressByBookId:{}, lastReadBookId: null });
  }

  // ---------- state & debug ----------
  function applyState(){
    const p = parseParams();
    const state = p.get("state") || "default";
    qsa("[data-state]").forEach(el=>{
      el.classList.toggle("is-active", el.getAttribute("data-state") === state);
    });
    // also support global banners
    document.documentElement.setAttribute("data-view-state", state);
    return state;
  }

  function initDebug(){
    const p = parseParams();
    const debug = p.get("debug") === "1";
    const panel = qs("[data-debug-panel]");
    if(!panel) return;
    panel.classList.toggle("is-on", debug);
    if(!debug) return;

    const stateSel = qs("select[data-debug-state]", panel);
    if(stateSel){
      stateSel.value = p.get("state") || "default";
      stateSel.addEventListener("change", ()=>{
        setParam("state", stateSel.value);
        applyState();
      });
    }
  }

  // ---------- modal ----------
  function openModal(id){
    const backdrop = qs(`#${id}`);
    if(!backdrop) return;
    backdrop.classList.add("is-open");
    const firstBtn = backdrop.querySelector("button, [href], input, select, textarea");
    if(firstBtn) firstBtn.focus();
  }
  function closeModal(id){
    const backdrop = qs(`#${id}`);
    if(!backdrop) return;
    backdrop.classList.remove("is-open");
  }
  function wireModals(){
    qsa("[data-modal-close]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-modal-close");
        closeModal(id);
      });
    });
    qsa(".modal-backdrop").forEach(b=>{
      b.addEventListener("click", (e)=>{
        if(e.target === b){
          b.classList.remove("is-open");
        }
      });
    });
    window.addEventListener("keydown", (e)=>{
      if(e.key === "Escape"){
        const open = qs(".modal-backdrop.is-open");
        if(open) open.classList.remove("is-open");
      }
    });
  }

  // ---------- toast ----------
  function toast(message, detail){
    const wrap = qs("[data-toast-wrap]");
    if(!wrap) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<div>${escapeHTML(message)}${detail?` <span class="mini">${escapeHTML(detail)}</span>`:""}</div>
      <button class="btn btn-ghost" type="button" aria-label="关闭提示">关闭</button>`;
    wrap.appendChild(el);
    const closeBtn = el.querySelector("button");
    closeBtn.addEventListener("click", ()=> el.remove());
    setTimeout(()=>{ if(el.isConnected) el.remove(); }, 2600);
  }

  function escapeHTML(s){
    return String(s).replace(/[&<>"']/g, (c)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // ---------- domain APIs (prototype) ----------
  function getLibraries(){
    const data = readJSON(K.libs, { schemaVersion:"2.0", libraries: [], activeLibraryId:null });
    const settings = getSettings();
    return { ...data, settings };
  }

  function setActiveLibrary(libId){
    const data = getLibraries();
    data.activeLibraryId = libId;
    writeJSON(K.libs, { schemaVersion:"2.0", libraries:data.libraries, activeLibraryId: libId });
    localStorage.setItem(K.activeLib, libId);
  }

  function removeLibrary(libId){
    const data = getLibraries();
    data.libraries = data.libraries.filter(l=>l.id !== libId);
    if(data.activeLibraryId === libId) data.activeLibraryId = data.libraries[0]?.id || null;
    writeJSON(K.libs, { schemaVersion:"2.0", libraries:data.libraries, activeLibraryId: data.activeLibraryId });
    if(data.activeLibraryId) localStorage.setItem(K.activeLib, data.activeLibraryId);
  }

  function setAutoOpen(enabled){
    const doc = getSettings();
    doc.autoOpenLastLibrary = !!enabled;
    writeSettings(doc);
  }

  function getBooks(libId){
    return readJSON(K.books(libId), { schemaVersion:"2.0", libraryId: libId, books: [] });
  }
  function writeBooks(libId, doc){
    writeJSON(K.books(libId), doc);
  }
  function getProgress(libId){
    return readJSON(K.progress(libId), { schemaVersion:"2.0", libraryId: libId, progressByBookId:{}, lastReadBookId:null });
  }
  function writeProgress(libId, doc){
    writeJSON(K.progress(libId), doc);
  }

  function updateProgress(libId, bookId, scrollRatio){
    const p = getProgress(libId);
    p.progressByBookId = p.progressByBookId || {};
    p.progressByBookId[bookId] = { scrollRatio: clamp01(scrollRatio), updatedAt: Date.now() };
    p.lastReadBookId = bookId;
    writeProgress(libId, p);
  }

  function importBooks(libId, files){
    const doc = getBooks(libId);
    const now = Date.now();
    const exists = new Set(doc.books.map(b=>b.filePath));
    const added = [];
    const dup = [];
    files.forEach(f=>{
      if(exists.has(f.filePath)){
        dup.push(f);
        return;
      }
      const book = {
        id: uid("book"),
        displayTitle: f.displayTitle,
        filePath: f.filePath,
        addedAt: now,
        lastOpenedAt: null,
        fileStat:{ size: f.size || 0, mtimeMs: f.mtimeMs || now },
        missing: false
      };
      doc.books.unshift(book);
      exists.add(f.filePath);
      added.push(book);
    });
    writeBooks(libId, doc);
    return { added, dup };
  }

  function getExtLower(filePath){
    const s = String(filePath||"");
    const m = s.match(/\.([a-z0-9]+)$/i);
    return m ? `.${m[1].toLowerCase()}` : "";
  }

  function guessTitleFromPath(filePath){
    const s = String(filePath||"");
    const base = s.split(/[\\/]/).pop() || s || "未命名";
    return base.replace(/\.[^.]+$/, "") || base || "未命名";
  }

  function normalizeImportItem(x){
    const filePath = x?.filePath || x?.path || x?.fullPath || x?.file || "";
    const displayTitle = x?.displayTitle || x?.title || x?.name || guessTitleFromPath(filePath);
    const size = Number(x?.size) || 0;
    const mtimeMs = Number(x?.mtimeMs || x?.mtime) || 0;
    const reason = x?.reason || x?.error || x?.message || "";
    return { displayTitle, filePath, size, mtimeMs, reason };
  }

  function normalizeImportResultShape(res){
    // Return a normalized shape:
    // { added:[{displayTitle,filePath}], dup:[{displayTitle,filePath}], failed:[{displayTitle,filePath,reason}] }
    const out = { added:[], dup:[], failed:[] };
    if(!res) return out;

    // If main process already returns categories
    if(res && typeof res === "object" && (Array.isArray(res.added) || Array.isArray(res.dup) || Array.isArray(res.failed))){
      out.added = (res.added||[]).map(normalizeImportItem);
      out.dup = (res.dup||[]).map(normalizeImportItem);
      out.failed = (res.failed||[]).map(normalizeImportItem);
      return out;
    }

    // If it returns per-file items with status
    const items = Array.isArray(res)
      ? res
      : (Array.isArray(res.items) ? res.items
        : (Array.isArray(res.files) ? res.files
          : (Array.isArray(res.picked) ? res.picked : null)));
    if(Array.isArray(items)){
      items.forEach(it=>{
        const n = normalizeImportItem(it);
        const st = String(it?.status || it?.result || "").toLowerCase();
        if(st === "added" || st === "new" || st === "imported") out.added.push(n);
        else if(st === "dup" || st === "duplicate" || st === "skipped") out.dup.push(n);
        else if(st === "failed" || st === "error") out.failed.push({ ...n, reason: n.reason || "导入失败" });
        else out.added.push(n); // treat as picked files list (renderer will dedupe later)
      });
      return out;
    }

    return out;
  }

  async function nativeImportBooks(libId){
    // Electron: call system file picker via preload API.
    // Non-Electron: returns null so caller can fallback to demo picker.
    if(!isElectron()) return null;
    if(typeof window.electronAPI?.bookImportFiles !== "function") return null;

    try{
      const raw = await window.electronAPI.bookImportFiles(libId);
      const normalized = normalizeImportResultShape(raw);

      // If normalized already contains "failed/dup/added" buckets but "added" are still just picked files,
      // run prototype-side dedupe+insert to keep bookshelf UI consistent.
      const hasExplicitBuckets = raw && typeof raw === "object" && (Array.isArray(raw.added) || Array.isArray(raw.dup) || Array.isArray(raw.failed));
      if(hasExplicitBuckets){
        // Heuristic: if added items don't look like already-added books (no id/addedAt),
        // treat them as picked file descriptors.
        const looksLikeBook = (raw.added||[]).some(x=>x && (x.id || x.addedAt));
        if(looksLikeBook){
          if(typeof window.electronAPI?.bookList === "function"){
            try{
              const list = await window.electronAPI.bookList(libId);
              if(list && list.success && Array.isArray(list.books)){
                writeBooks(libId, { schemaVersion:"2.0", libraryId: libId, books: list.books });
              }
            }catch(_e){}
          }
          // Main process already imported; keep shape but don't mutate prototype storage.
          return {
            added: normalized.added.map(x=>({ displayTitle:x.displayTitle, filePath:x.filePath })),
            dup: normalized.dup.map(x=>({ displayTitle:x.displayTitle, filePath:x.filePath })),
            failed: normalized.failed.map(x=>({ displayTitle:x.displayTitle, filePath:x.filePath, reason:x.reason || "导入失败" })),
          };
        }
      }

      // Otherwise treat (normalized.added) as picked files list.
      const picked = normalized.added.map(x=>({
        displayTitle: x.displayTitle,
        filePath: x.filePath,
        size: x.size,
        mtimeMs: x.mtimeMs,
      })).filter(x=>!!x.filePath);

      const allowExt = new Set([".txt",".log",".md"]);
      const okFiles = [];
      const failed = normalized.failed.map(x=>({ displayTitle:x.displayTitle, filePath:x.filePath, reason: x.reason || "导入失败" }));
      picked.forEach(f=>{
        const ext = getExtLower(f.filePath);
        if(ext && !allowExt.has(ext)){
          failed.push({ displayTitle: f.displayTitle, filePath: f.filePath, reason: `不支持的格式：${ext}` });
          return;
        }
        okFiles.push(f);
      });

      const { added, dup } = importBooks(libId, okFiles);
      return {
        added: added.map(b=>({ displayTitle:b.displayTitle, filePath:b.filePath })),
        dup: dup.map(d=>({ displayTitle:d.displayTitle || guessTitleFromPath(d.filePath), filePath:d.filePath })),
        failed,
      };
    }catch(e){
      const msg = (e && (e.message || String(e))) || "未知错误";
      return { added:[], dup:[], failed:[{ displayTitle:"导入失败", filePath:"", reason: msg }] };
    }
  }

  function relinkBook(libId, bookId, newPath){
    const doc = getBooks(libId);
    const b = doc.books.find(x=>x.id === bookId);
    if(!b) return false;
    b.filePath = newPath;
    b.missing = false;
    b.fileStat = b.fileStat || {};
    b.fileStat.mtimeMs = Date.now();
    writeBooks(libId, doc);
    return true;
  }

  function removeBook(libId, bookId){
    const doc = getBooks(libId);
    doc.books = doc.books.filter(b=>b.id !== bookId);
    writeBooks(libId, doc);
    const p = getProgress(libId);
    if(p.progressByBookId) delete p.progressByBookId[bookId];
    if(p.lastReadBookId === bookId) p.lastReadBookId = null;
    writeProgress(libId, p);
  }

  // ---------- base init ----------
  function initBase(){
    seed();
    initNativeMode();
    initAppearance();
    wireModals();
    applyState();
    initDebug();
    if(!isElectron()) initSimWindow();
    initNativeResize();
  }

  // Expose
  FB.qs = qs; FB.qsa = qsa;
  FB.formatTime = formatTime;
  FB.parseParams = parseParams;
  FB.setParam = setParam;
  FB.applyState = applyState;
  FB.openModal = openModal;
  FB.closeModal = closeModal;
  FB.toast = toast;

  FB.settings = {
    THEMES,
    get: getSettings,
    setAppearance,
    resetAppearance,
    applyAppearance,
  };

  FB.data = {
    getLibraries, setActiveLibrary, removeLibrary, setAutoOpen,
    getBooks, getProgress, updateProgress, importBooks, relinkBook, removeBook
  };

  FB.nativeImportBooks = nativeImportBooks;

  FB.initBase = initBase;
  window.FB = FB;
})();
