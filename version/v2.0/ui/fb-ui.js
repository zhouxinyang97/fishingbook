(function(){
  const FB = {};

  // ---------- utils ----------
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function isElectron(){
    return !!(window.electronAPI && typeof window.electronAPI === "object");
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

  let cachedSettings = normalizeSettingsDoc(null);

  async function refreshSettings(){
    if(isElectron() && typeof window.electronAPI?.settingsGet === "function"){
      const res = await window.electronAPI.settingsGet();
      if(res && res.success) cachedSettings = normalizeSettingsDoc(res.data);
    }
    return cachedSettings;
  }

  async function updateSettings(patch){
    if(isElectron() && typeof window.electronAPI?.settingsUpdate === "function"){
      const res = await window.electronAPI.settingsUpdate(patch);
      if(res && res.success) cachedSettings = normalizeSettingsDoc(res.data);
    }
    return cachedSettings;
  }

  function getSettings(){
    return cachedSettings;
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

  async function setAppearance(patch){
    const next = {
      appearance: { ...(cachedSettings.appearance||{}), ...(patch||{}) }
    };
    const saved = await updateSettings(next);
    applyAppearance(saved.appearance);
    return saved.appearance;
  }

  async function resetAppearance(){
    const saved = await updateSettings({ appearance: { ...(DEFAULT_SETTINGS.appearance) } });
    applyAppearance(saved.appearance);
    return saved.appearance;
  }

  async function initAppearance(){
    const s = await refreshSettings();
    applyAppearance(s.appearance);
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


  // ---------- base init ----------
  async function initBase(){
    initNativeMode();
    await initAppearance();
    wireModals();
    initNativeResize();
  }

  // Expose
  FB.qs = qs; FB.qsa = qsa;
  FB.parseParams = parseParams;
  FB.setParam = setParam;
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

  FB.initBase = initBase;
  window.FB = FB;
})();
