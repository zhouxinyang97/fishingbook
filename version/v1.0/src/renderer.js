const appWindow = document.getElementById('app-window');
const contentArea = document.getElementById('content-area');
const opacitySlider = document.getElementById('opacity-slider');
const fileInput = document.getElementById('file-input');
const loadFileBtn = document.getElementById('load-file-btn');
const fileNameDisplay = document.getElementById('file-name-display');
const resizeOverlay = document.getElementById('resize-overlay');

let isPinned = false;
const pinBtn = document.querySelector('.pin-btn');

let lastLoadedText = null;
let lastLoadedFileName = null;
let lastLoadedFilePath = null;
let lastScrollRatio = 0;

// Window Controls
pinBtn.addEventListener('click', () => {
    isPinned = !isPinned;
    window.electronAPI.toggleAlwaysOnTop(isPinned);
    pinBtn.style.backgroundColor = isPinned ? '#007acc' : '#a0a0a0';
});

// Global keyboard shortcuts for scrolling
document.addEventListener('keydown', (e) => {
    if (document.activeElement === opacitySlider) return;

    const scrollAmount = 50;
    if (e.key === 'ArrowUp') {
        contentArea.scrollTop -= scrollAmount;
    } else if (e.key === 'ArrowDown') {
        contentArea.scrollTop += scrollAmount;
    } else if (e.key === 'PageUp') {
        contentArea.scrollTop -= contentArea.clientHeight;
    } else if (e.key === 'PageDown') {
        contentArea.scrollTop += contentArea.clientHeight;
    }
});

let saveScrollRafId = null;
function getScrollRatio() {
    const maxScroll = Math.max(contentArea.scrollHeight - contentArea.clientHeight, 1);
    return contentArea.scrollTop / maxScroll;
}

function scheduleSaveSession() {
    if (!lastLoadedFilePath) return;
    if (saveScrollRafId != null) return;
    saveScrollRafId = requestAnimationFrame(() => {
        saveScrollRafId = null;
        window.electronAPI.saveSession({ filePath: lastLoadedFilePath, scrollRatio: getScrollRatio() });
    });
}

contentArea.addEventListener('scroll', () => {
    if (isResizing) return;
    scheduleSaveSession();
});

document.querySelector('.minimize-btn').addEventListener('click', () => {
    window.electronAPI.minimize();
});

const maximizeBtn = document.querySelector('.maximize-btn');
maximizeBtn.addEventListener('click', () => {
    window.electronAPI.maximize();
});

// Listen for window state changes to update the maximize button
window.electronAPI.onWindowStateChange((state) => {
    if (state === 'maximized') {
        maximizeBtn.title = 'Restore';
        // Simulating "restore" icon or state by darkening
        maximizeBtn.style.opacity = '0.6';
    } else {
        maximizeBtn.title = 'Maximize';
        maximizeBtn.style.opacity = '1';
    }
});

const resizers = document.querySelectorAll('.resizer');
let isResizing = false;
let currentResizer = null;
let startX, startY, startW, startH, startTop, startLeft;
let pendingBounds = null;
let resizeTicking = false;
let lastSentBounds = null;
let lastResizeSendAt = 0;
let didClearDuringResize = false;

resizers.forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentResizer = resizer;
        startX = e.screenX;
        startY = e.screenY;
        
        // Initial state capture
        startW = window.outerWidth;
        startH = window.outerHeight;
        startTop = window.screenY;
        startLeft = window.screenX;

        lastScrollRatio = getScrollRatio();
        didClearDuringResize = false;
        contentArea.style.display = 'none';
        contentArea.textContent = '';
        didClearDuringResize = true;
        if (resizeOverlay) resizeOverlay.style.display = 'flex';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
});

function boundsEqual(a, b) {
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function scheduleResizeTick() {
    if (resizeTicking) return;
    resizeTicking = true;
    const tick = () => {
        if (!isResizing) {
            resizeTicking = false;
            return;
        }
        if (pendingBounds) {
            const now = performance.now();
            if (now - lastResizeSendAt >= 33 && !boundsEqual(pendingBounds, lastSentBounds)) {
                window.electronAPI.resizeWindow(pendingBounds);
                lastSentBounds = pendingBounds;
                lastResizeSendAt = now;
            }
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function onMouseMove(e) {
    if (!isResizing) return;

    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    
    let newW = startW;
    let newH = startH;
    let newX = startLeft;
    let newY = startTop;

    const classList = currentResizer.classList;
    
    // Logic for 8 directions
    if (classList.contains('right')) {
        newW = startW + dx;
    } 
    else if (classList.contains('left')) {
        newW = startW - dx;
        newX = startLeft + dx;
    } 
    else if (classList.contains('bottom')) {
        newH = startH + dy;
    } 
    else if (classList.contains('top')) {
        newH = startH - dy;
        newY = startTop + dy;
    } 
    else if (classList.contains('bottom-right')) {
        newW = startW + dx;
        newH = startH + dy;
    } 
    else if (classList.contains('bottom-left')) {
        newW = startW - dx;
        newH = startH + dy;
        newX = startLeft + dx;
    } 
    else if (classList.contains('top-right')) {
        newW = startW + dx;
        newH = startH - dy;
        newY = startTop + dy;
    } 
    else if (classList.contains('top-left')) {
        newW = startW - dx;
        newH = startH - dy;
        newX = startLeft + dx;
        newY = startTop + dy;
    }

    // Min size constraints
    if (newW < 200) newW = 200;
    if (newH < 150) newH = 150;
    
    pendingBounds = { x: newX, y: newY, width: newW, height: newH };
    scheduleResizeTick();
}

function onMouseUp() {
    isResizing = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (pendingBounds && !boundsEqual(pendingBounds, lastSentBounds)) window.electronAPI.resizeWindow(pendingBounds);
    pendingBounds = null;
    if (resizeOverlay) resizeOverlay.style.display = 'none';
    contentArea.style.display = '';
    if (didClearDuringResize && lastLoadedText != null && lastLoadedFileName != null) {
        renderText(lastLoadedText, lastLoadedFileName, { restoreScrollRatio: lastScrollRatio });
    }
}

document.querySelector('.close-btn').addEventListener('click', () => {
    window.electronAPI.close();
});

// Transparency Control
opacitySlider.addEventListener('input', (e) => {
    const val = e.target.value / 100;
    // Update background rgba alpha channel
    appWindow.style.backgroundColor = `rgba(30, 30, 30, ${val})`;
});

// Trigger file input when "Load File" button is clicked
loadFileBtn.addEventListener('click', () => {
    window.electronAPI.openFile().then((result) => {
        if (!result || !result.success) {
            return;
        }
        fileNameDisplay.textContent = `${result.fileName}${result.encoding ? ' · ' + result.encoding : ''}`;
        lastLoadedText = result.content;
        lastLoadedFileName = result.fileName;
        lastLoadedFilePath = result.filePath;
        renderText(lastLoadedText, lastLoadedFileName);
        window.electronAPI.saveSession({ filePath: lastLoadedFilePath, scrollRatio: 0 });
    });
});

// File Load Simulation
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;
    
    // In Electron, file objects from input have a 'path' property
    if (file.path) {
        try {
            const result = await window.electronAPI.loadFile(file.path);
            if (result.success) {
                console.log(`Loaded file with encoding: ${result.encoding}`);
                lastLoadedText = result.content;
                lastLoadedFileName = file.name;
                lastLoadedFilePath = file.path;
                renderText(lastLoadedText, lastLoadedFileName);
                window.electronAPI.saveSession({ filePath: lastLoadedFilePath, scrollRatio: 0 });
            } else {
                console.error('Failed to load file:', result.error);
                contentArea.innerHTML = `<span class="log-info">ERROR</span> Failed to load file: ${result.error}`;
            }
        } catch (err) {
            console.error('Error loading file:', err);
        }
    } else {
        // Fallback for browser testing (without node integration)
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            lastLoadedText = text;
            lastLoadedFileName = file.name;
            lastLoadedFilePath = null;
            renderText(lastLoadedText, lastLoadedFileName);
        };
        reader.readAsText(file);
    }
});

function renderText(text, filename, options) {
    // Convert plain text to "Log" format for the MVP
    const lines = text.split('\n');
    let html = '<span class="comment">// Loaded: ' + filename + '</span><br>';
    html += '<span class="comment">// -----------------------------------</span><br><br>';
    
    // Simple mock time generator to make it look sequential
    let baseTime = new Date();
    
    lines.forEach((line, index) => {
        if (line.trim() === '') {
            html += '<br>';
            return;
        }
        
        // Increment time slightly for realism
        baseTime.setSeconds(baseTime.getSeconds() + 1);
        const timeStr = baseTime.toLocaleTimeString('en-US', { hour12: false });
        
        // Randomize log level occasionally
        const levels = ['INFO', 'DEBUG', 'WARN', 'DATA'];
        const level = levels[index % 4];
        let levelClass = 'log-info';
        if (level === 'DEBUG') levelClass = 'log-info'; // or gray
        if (level === 'WARN') levelClass = 'comment'; // yellowish in some themes, using comment color for now
        
        // Use consistent colors for levels
        const levelSpan = `<span class="${level === 'WARN' ? 'comment' : 'log-info'}">${level.padEnd(5)}</span>`;

        html += `<span class="log-time">[${timeStr}]</span> ${levelSpan} <span class="log-text">${escapeHtml(line)}</span><br>`;
    });
    
    contentArea.innerHTML = html;
    if (options && typeof options.restoreScrollRatio === 'number') {
        const maxScroll = Math.max(contentArea.scrollHeight - contentArea.clientHeight, 0);
        contentArea.scrollTop = Math.round(maxScroll * options.restoreScrollRatio);
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.electronAPI.getLastSession().then((result) => {
    if (!result || !result.success) return;
    lastLoadedText = result.content;
    lastLoadedFileName = result.fileName;
    lastLoadedFilePath = result.filePath;
    fileNameDisplay.textContent = `${result.fileName}${result.encoding ? ' · ' + result.encoding : ''}`;
    renderText(lastLoadedText, lastLoadedFileName, { restoreScrollRatio: result.scrollRatio || 0 });
});
