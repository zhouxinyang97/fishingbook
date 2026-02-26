
const appWindow = document.getElementById('app-window');
const contentArea = document.getElementById('content-area');
const tabTitle = document.getElementById('tab-title');
const libraryBtn = document.getElementById('library-btn');
const opacitySlider = document.getElementById('opacity-slider');

// Window Controls
const pinBtn = document.getElementById('pin-btn');
const minBtn = document.getElementById('min-btn');
const maxBtn = document.getElementById('max-btn');
const closeBtn = document.getElementById('close-btn');

// State Management
let appState = {
    view: 'reader', // 'reader', 'library'
    books: [],
    currentBookId: null,
    isMaximized: false,
    isPinned: false,
    fontSize: 14,
    fontColor: '#d4d4d4'
};

// Default Content
const defaultBookHtml = `
    <span class="comment">// Application Startup Sequence initiated...</span><br>
    <span class="log-time">[SYSTEM]</span> <span class="log-info">INFO</span>  <span class="log-text">Welcome to Fishing Book v2.1.1</span><br>
    <span class="comment">// --------------------------------------------------</span><br>
    <span class="comment">// Please add a book from the Library.</span><br>
    <span class="comment">// --------------------------------------------------</span><br>
`;

// Initialization
async function init() {
    // Load from disk via IPC
    try {
        const res = await window.api.data.load();
        if (res.success && res.data) {
            appState.books = res.data.books || [];
            appState.currentBookId = res.data.currentBookId || null;
            appState.isPinned = res.data.isPinned || false;
            appState.fontSize = res.data.fontSize || 14;
            appState.fontColor = res.data.fontColor || '#d4d4d4';
        }
    } catch (e) {
        console.error('Failed to load data', e);
    }

    // Sync Pin State
    if (appState.isPinned) {
        window.api.windowControl.setAlwaysOnTop(true);
        pinBtn.classList.add('active');
        updatePinIcon(true);
    }

    // Apply Font Settings
    updateFontSettings();

    // Restore Window Size if saved (Optional)
    // if (res.data.windowBounds) window.api.windowControl.resize(res.data.windowBounds);

    // If no books, add default placeholder or go to library
    if (appState.books.length === 0) {
        appState.view = 'library';
    } else {
        // Verify if files still exist? Maybe later.
        appState.view = 'reader';
    }

    render();
}

async function saveData() {
    // Persist to disk
    await window.api.data.save({
        books: appState.books,
        currentBookId: appState.currentBookId,
        isPinned: appState.isPinned,
        fontSize: appState.fontSize,
        fontColor: appState.fontColor
    });
}

function render() {
    renderHeader();
    if (appState.view === 'library') {
        renderLibrary();
    } else {
        renderReader();
    }
}

function renderHeader() {
    // Update Title
    if (appState.view === 'library') {
        tabTitle.innerHTML = '<span class="keyword">View</span>: Library';
        libraryBtn.classList.add('active');
        libraryBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <span>Reader</span>`;
    } else {
        // Reader Mode
        const currentBook = appState.books.find(b => b.id === appState.currentBookId);
        const bookName = currentBook ? currentBook.name : 'No File';
        tabTitle.innerHTML = `<span class="log-time">#</span> ${bookName}`;
        libraryBtn.classList.remove('active');
        libraryBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <span>Library</span>`;
    }
}

function renderLibrary() {
    let html = '<div class="book-list">';
    
    if (appState.books.length === 0) {
        html += '<div class="empty-state">// No books found.<br>// Please add a file to start reading.</div>';
    } else {
        // Header row
        html += '<div style="padding: 5px 12px; color: #555; font-size: 12px; display: flex; font-family: monospace;">' +
                '<span style="width: 40px; text-align: right; margin-right: 15px;">ID</span>' +
                '<span style="flex:1">FILENAME</span>' +
                '<span style="width: 80px;">PROGRESS</span>' +
                '</div>';
        
        appState.books.forEach(book => {
            const isCurrent = book.id === appState.currentBookId;
            const activeStyle = isCurrent ? 'background-color: rgba(55, 55, 60, 0.5);' : '';
            const indicator = isCurrent ? '<span style="color: #007acc; margin-right: 5px;">*</span>' : '';
            
            html += `
            <div class="book-item" style="${activeStyle}" onclick="openBook('${book.id}')">
                <span class="book-id">${book.id.slice(-4)}</span>
                <span class="book-name">${indicator}${book.name}</span>
                <span class="book-progress">${book.progress || '0%'}</span>
                <span class="book-delete" onclick="deleteBook('${book.id}', event)">[del]</span>
            </div>`;
        });
    }

    // Add Book Button
    html += `
        <div class="add-book-row" onclick="triggerAddBook()">
            <span class="keyword">+</span> Add New Book (Upload .txt/.log/.md)
        </div>
    </div>`;

    contentArea.innerHTML = html;
}

function renderReader() {
    const book = appState.books.find(b => b.id === appState.currentBookId);
    if (!book) {
        contentArea.innerHTML = defaultBookHtml;
        return;
    }
    
    // Detach scroll listener temporarily to prevent saving while restoring
    contentArea.onscroll = null;
    
    // If content is missing (loaded from JSON but not read from file yet)
    if (!book.content && book.filePath) {
        loadBookContent(book);
        contentArea.innerHTML = '<span class="log-info">Loading...</span>';
        return;
    }
    contentArea.innerHTML = book.content || defaultBookHtml;
    
    // Restore scroll position
    if (book.progress) {
        // progress is stored as percentage string "12%"
        const percentage = parseFloat(book.progress) / 100;
        if (!isNaN(percentage)) {
             // We need to wait for DOM update
             requestAnimationFrame(() => {
                 contentArea.scrollTop = (contentArea.scrollHeight - contentArea.clientHeight) * percentage;
             });
        }
    }

    // Attach scroll listener for this book
    // Remove old listener first to avoid duplicates/leaks if re-rendering?
    // contentArea is a single element, so setting onscroll overwrites previous handler.
    contentArea.onscroll = handleScroll;
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle Scroll with Debounce
const handleScroll = debounce(() => {
    if (appState.view !== 'reader' || !appState.currentBookId) return;
    
    const scrollTop = contentArea.scrollTop;
    const scrollHeight = contentArea.scrollHeight;
    const clientHeight = contentArea.clientHeight;
    
    // Avoid division by zero
    const maxScroll = scrollHeight - clientHeight;
    let percentage = 0;
    if (maxScroll > 0) {
        percentage = scrollTop / maxScroll;
    }
    
    // Format as percentage string
    // let percentage = 0;
    if (maxScroll > 0) {
        percentage = scrollTop / maxScroll;
    }
    const progressStr = (percentage * 100).toFixed(1) + '%';
    
    // Update state
    const book = appState.books.find(b => b.id === appState.currentBookId);
    if (book) {
        book.progress = progressStr;
        // Don't save full list every scroll, just update in memory?
        // But user asked for auto-save.
        // We are debounced, so it's okay.
        saveData(); 
    }
}, 500);

async function loadBookContent(book) {
    try {
        const res = await window.api.file.read(book.filePath);
        if (res.success) {
            book.content = formatTextToLog(res.content, book.name);
            saveData(); // Optional: don't save full content to JSON to keep it small? 
            // Better: Don't save content to JSON. Only save path.
            // On load, re-read file. 
            // For now, to keep it simple, we re-render.
            renderReader();
        } else {
            book.content = `<span class="error">// Error loading file: ${res.error}</span>`;
            renderReader();
        }
    } catch (e) {
        book.content = `<span class="error">// Error: ${e.message}</span>`;
        renderReader();
    }
}

function formatTextToLog(text, fileName) {
    const lines = text.split('\n');
    let html = '';
    
    // Add header
    html += `<span class="comment">// Loaded: ${fileName}</span><br>`;
    html += `<span class="comment">// -----------------------------------</span><br><br>`;
    
    lines.forEach((line, index) => {
        if (line.trim() === '') {
            html += '<br>';
            return;
        }
        
        // Simple heuristic for log styling
        if (line.trim().startsWith('//')) {
             html += `<span class="comment">${escapeHtml(line)}</span><br>`;
        } else {
             const time = new Date().toLocaleTimeString('en-US', { hour12: false });
             html += `<span class="log-time">[${time}]</span> <span class="log-info">DATA</span> <span class="log-text">${escapeHtml(line)}</span><br>`;
        }
    });
    return html;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Global Actions
window.toggleLibrary = function() {
    if (appState.view === 'reader') {
        appState.view = 'library';
    } else {
        if (appState.books.length > 0) {
            appState.view = 'reader';
        }
    }
    render();
}

window.openBook = function(id) {
    appState.currentBookId = id;
    appState.view = 'reader';
    saveData();
    render();
}

window.triggerAddBook = async function() {
    const res = await window.api.file.openDialog();
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) return;

    for (const filePath of res.filePaths) {
        // Read file to get name and initial content
        const fileRes = await window.api.file.read(filePath);
        if (fileRes.success) {
             const newId = String(Date.now()) + Math.floor(Math.random() * 1000);
             const formattedHtml = formatTextToLog(fileRes.content, fileRes.fileName);
             
             const newBook = {
                id: newId,
                name: fileRes.fileName,
                filePath: filePath,
                content: formattedHtml, // In-memory cache
                progress: '0%'
             };
             
             // Check duplicates?
             const exists = appState.books.find(b => b.filePath === filePath);
             if (!exists) {
                appState.books.push(newBook);
                appState.currentBookId = newId;
             } else {
                appState.currentBookId = exists.id;
             }
        }
    }
    appState.view = 'reader';
    saveData(); // Note: We should probably NOT save 'content' field to disk to avoid huge JSON files
    // But for MVP, if we don't save content, we need to reload it every time.
    // Let's clean content before saving.
    render();
}

// Override save to exclude content
const originalSave = saveData;
saveData = async function() {
    // Create a lightweight copy for storage
    const booksToSave = appState.books.map(b => ({
        id: b.id,
        name: b.name,
        filePath: b.filePath,
        progress: b.progress
        // content is excluded
    }));
    
    await window.api.data.save({
        books: booksToSave,
        currentBookId: appState.currentBookId,
        isPinned: appState.isPinned,
        fontSize: appState.fontSize,
        fontColor: appState.fontColor
    });
}

window.deleteBook = function(id, event) {
    event.stopPropagation();
    if (confirm('Delete this book from library?')) {
        appState.books = appState.books.filter(b => b.id !== id);
        if (appState.currentBookId === id) {
            appState.currentBookId = appState.books.length > 0 ? appState.books[0].id : null;
        }
        saveData();
        render();
    }
}

const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeInput = document.getElementById('font-size-input');
// Use class selector to get specific elements if IDs are not unique or if we want to select by class
// But wait, color-circle are multiple.
// Let's re-select them inside the setup function or use global selector.
const colorCircles = document.querySelectorAll('.color-circle:not(.custom-color-trigger)');
const customColorPicker = document.getElementById('custom-color-picker');
const customColorTrigger = document.querySelector('.custom-color-trigger');

if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click from closing immediately
        settingsPanel.classList.toggle('hidden');
        settingsBtn.classList.toggle('active');
    });
}

// Close settings when clicking outside
document.addEventListener('click', (e) => {
    if (settingsBtn && settingsPanel && 
        !settingsBtn.contains(e.target) && 
        !settingsPanel.contains(e.target)) {
        settingsPanel.classList.add('hidden');
        settingsBtn.classList.remove('active');
    }
});

if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', (e) => {
        appState.fontSize = parseInt(e.target.value);
        updateFontSettings();
        saveData();
    });
}

if (fontSizeInput) {
    fontSizeInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) {
            appState.fontSize = val;
            updateFontSettings(false); // Pass false to avoid updating input while typing
            saveData();
        }
    });
    
    // Validate on blur
    fontSizeInput.addEventListener('blur', () => {
        if (appState.fontSize < 8) appState.fontSize = 8;
        if (appState.fontSize > 128) appState.fontSize = 128;
        updateFontSettings();
        saveData();
    });
}

colorCircles.forEach(circle => {
    circle.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        appState.fontColor = color;
        updateFontSettings();
        saveData();
    });
});

if (customColorPicker) {
    // 'input' fires while dragging, 'change' fires on close. 'input' is better for live preview.
    customColorPicker.addEventListener('input', (e) => {
        appState.fontColor = e.target.value;
        updateFontSettings();
        saveData();
    });
}

function updateFontSettings(updateInput = true) {
    if (!contentArea) return;
    
    // Update CSS variables
    contentArea.style.setProperty('--main-font-size', appState.fontSize + 'px');
    contentArea.style.setProperty('--main-font-color', appState.fontColor);
    
    // Update UI controls to match state
    if (fontSizeInput && updateInput) fontSizeInput.value = appState.fontSize;
    if (fontSizeSlider) fontSizeSlider.value = appState.fontSize;
    
    // Update active color circle
    document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
    
    // Try to find matching preset
    let matched = false;
    colorCircles.forEach(c => {
        // Simple case-insensitive hex check
        if (c.dataset.color && c.dataset.color.toLowerCase() === appState.fontColor.toLowerCase()) {
            c.classList.add('active');
            matched = true;
        }
    });
    
    // If not matched, activate custom trigger
    if (!matched && customColorTrigger) {
        customColorTrigger.classList.add('active');
        customColorTrigger.style.backgroundColor = appState.fontColor;
        customColorTrigger.style.borderStyle = 'solid';
        if (customColorPicker) customColorPicker.value = appState.fontColor;
    } else if (customColorTrigger) {
        // Reset custom trigger style if using preset
        customColorTrigger.classList.remove('active');
        customColorTrigger.style.backgroundColor = 'transparent';
        customColorTrigger.style.borderStyle = 'dashed';
    }
}

// Event Listeners
if (libraryBtn) libraryBtn.addEventListener('click', toggleLibrary);

if (pinBtn) {
    pinBtn.addEventListener('click', () => {
        appState.isPinned = !appState.isPinned;
        window.api.windowControl.setAlwaysOnTop(appState.isPinned);
        pinBtn.classList.toggle('active', appState.isPinned);
        updatePinIcon(appState.isPinned);
        saveData();
    });
}

function updatePinIcon(isPinned) {
    if (isPinned) {
        pinBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.5 2h-4L4 5v2h2v5l1 1h1l1-1V7h2V5L9.5 2z m-1 5H6.5V5h2v2z" />
        </svg>`;
    } else {
         pinBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
             <path d="M9.5 2h-4L4 5v2h2v5l1 1h1l1-1V7h2V5L9.5 2z m-1 5H6.5V5h2v2z" style="opacity: 0.5"/>
        </svg>`;
    }
}

if (minBtn) minBtn.addEventListener('click', () => window.api.windowControl.minimize());

if (maxBtn) {
    maxBtn.addEventListener('click', () => {
        if (appState.isMaximized) {
            window.api.windowControl.unmaximize();
        } else {
            window.api.windowControl.maximize();
        }
        // The actual state update will come from IPC event
    });
}

// Listen for window state changes from main process
if (window.api.windowControl.onStateChange) {
    window.api.windowControl.onStateChange((state) => {
        appState.isMaximized = (state === 'maximized');
        updateMaxIcon(appState.isMaximized);
    });
}

function updateMaxIcon(isMax) {
    if (isMax) {
        maxBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 5v9h9V5H3zm8 8H4V6h7v7z"/>
            <path d="M5 5h1V4h7v7h-1v1h2V3H5v2z"/>
        </svg>`;
    } else {
        maxBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 3v10h10V3H3zm9 9H4V4h8v8z"/>
        </svg>`;
    }
}

if (closeBtn) closeBtn.addEventListener('click', () => window.api.windowControl.close());

if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
        const val = e.target.value / 100;
        appWindow.style.backgroundColor = `rgba(30, 30, 30, ${val})`;
    });
}

// Resize Logic
const resizeHandles = document.querySelectorAll('.resize-handle');
const resizeOverlay = document.getElementById('resize-overlay');
let isResizing = false;
let resizeDirection = '';
let initialMouseX = 0;
let initialMouseY = 0;
let initialBounds = null;
let lastScrollPercentage = 0;

resizeHandles.forEach(handle => {
    handle.addEventListener('mousedown', async (e) => {
        // Prevent default to avoid text selection etc
        e.preventDefault();
        
        isResizing = true;
        resizeDirection = handle.dataset.direction;
        initialMouseX = e.screenX;
        initialMouseY = e.screenY;
        
        // Get initial window bounds
        try {
            initialBounds = await window.api.windowControl.getBounds();
        } catch (err) {
            console.error('Failed to get window bounds', err);
            isResizing = false;
            return;
        }

        // Set cursor for body
        let cursor = 'default';
        if (resizeDirection === 'top') cursor = 'n-resize';
        if (resizeDirection === 'bottom') cursor = 's-resize';
        if (resizeDirection === 'left') cursor = 'w-resize';
        if (resizeDirection === 'right') cursor = 'e-resize';
        if (resizeDirection === 'bottom-right') cursor = 'se-resize';
        if (resizeDirection === 'top-left') cursor = 'nw-resize';
        if (resizeDirection === 'top-right') cursor = 'ne-resize';
        if (resizeDirection === 'bottom-left') cursor = 'sw-resize';
        document.body.style.cursor = cursor;
        if (resizeOverlay) resizeOverlay.style.cursor = cursor;

        // Calculate scroll percentage before hiding
        if (contentArea && contentArea.scrollHeight > contentArea.clientHeight) {
            lastScrollPercentage = contentArea.scrollTop / (contentArea.scrollHeight - contentArea.clientHeight);
        } else {
            lastScrollPercentage = 0;
        }

        // Show overlay and hide content to improve performance
        if (resizeOverlay) resizeOverlay.classList.remove('hidden');
        if (contentArea) contentArea.classList.add('hidden');
    });
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing || !initialBounds) return;
    
    // Use requestAnimationFrame to throttle IPC calls
    requestAnimationFrame(() => {
        const deltaX = e.screenX - initialMouseX;
        const deltaY = e.screenY - initialMouseY;
        
        let newBounds = { ...initialBounds };

        switch (resizeDirection) {
            case 'bottom-right':
                newBounds.width = initialBounds.width + deltaX;
                newBounds.height = initialBounds.height + deltaY;
                break;
            case 'right':
                newBounds.width = initialBounds.width + deltaX;
                break;
            case 'bottom':
                newBounds.height = initialBounds.height + deltaY;
                break;
            case 'left':
                newBounds.x = initialBounds.x + deltaX;
                newBounds.width = initialBounds.width - deltaX;
                break;
            case 'top':
                newBounds.y = initialBounds.y + deltaY;
                newBounds.height = initialBounds.height - deltaY;
                break;
            case 'top-left':
                newBounds.x = initialBounds.x + deltaX;
                newBounds.y = initialBounds.y + deltaY;
                newBounds.width = initialBounds.width - deltaX;
                newBounds.height = initialBounds.height - deltaY;
                break;
            case 'top-right':
                newBounds.y = initialBounds.y + deltaY;
                newBounds.width = initialBounds.width + deltaX;
                newBounds.height = initialBounds.height - deltaY;
                break;
            case 'bottom-left':
                newBounds.x = initialBounds.x + deltaX;
                newBounds.width = initialBounds.width - deltaX;
                newBounds.height = initialBounds.height + deltaY;
                break;
        }
        
        // Minimum size constraint
        const MIN_WIDTH = 400;
        const MIN_HEIGHT = 300;

        if (newBounds.width < MIN_WIDTH) {
            // Adjust x if resizing from left
            if (resizeDirection === 'left' || resizeDirection === 'top-left' || resizeDirection === 'bottom-left') {
                newBounds.x = initialBounds.x + (initialBounds.width - MIN_WIDTH);
            }
            newBounds.width = MIN_WIDTH;
        }
        
        if (newBounds.height < MIN_HEIGHT) {
            // Adjust y if resizing from top
            if (resizeDirection === 'top' || resizeDirection === 'top-left' || resizeDirection === 'top-right') {
                newBounds.y = initialBounds.y + (initialBounds.height - MIN_HEIGHT);
            }
            newBounds.height = MIN_HEIGHT;
        }

        // Ensure integers
        newBounds.x = Math.round(newBounds.x);
        newBounds.y = Math.round(newBounds.y);
        newBounds.width = Math.round(newBounds.width);
        newBounds.height = Math.round(newBounds.height);

        window.api.windowControl.resize(newBounds);
    });
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        initialBounds = null;
        document.body.style.cursor = 'default';
        if (resizeOverlay) resizeOverlay.style.cursor = 'default';
        
        // Hide overlay and restore content
        if (resizeOverlay) resizeOverlay.classList.add('hidden');
        if (contentArea) {
            contentArea.classList.remove('hidden');
            
            // Restore scroll position based on percentage
            // Use setTimeout/rAF to ensure layout is recalculated
            requestAnimationFrame(() => {
                if (contentArea.scrollHeight > contentArea.clientHeight) {
                    contentArea.scrollTop = lastScrollPercentage * (contentArea.scrollHeight - contentArea.clientHeight);
                }
            });
        }
    }
});

// Start
document.addEventListener('DOMContentLoaded', init);
