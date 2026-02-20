
const appWindow = document.getElementById('app-window');
const contentArea = document.getElementById('content-area');
const tabTitle = document.getElementById('tab-title');
const libraryBtn = document.getElementById('library-btn');
const opacitySlider = document.getElementById('opacity-slider');
const fileInput = document.getElementById('file-input');

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
    isPinned: false
};


// Default Content (Pre-formatted HTML similar to v1.0)
const defaultBookHtml = `
    <span class="comment">// Application Startup Sequence initiated...</span><br>
    <span class="log-time">[10:23:41]</span> <span class="log-info">INFO</span>  <span class="log-text">Loading core modules... done.</span><br>
    <span class="log-time">[10:23:42]</span> <span class="log-info">INFO</span>  <span class="log-text">Connecting to database... success.</span><br>
    <span class="comment">// --------------------------------------------------</span><br>
    <span class="comment">// Chapter 1: The Beginning</span><br>
    <span class="comment">// --------------------------------------------------</span><br>
    <span class="log-time">[10:23:45]</span> <span class="log-info">DEBUG</span> <span class="log-text">It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.</span><br>
    <br>
    <span class="log-time">[10:23:46]</span> <span class="log-info">DEBUG</span> <span class="log-text">The hallway smelt of boiled cabbage and old rag mats. At one end of it a coloured poster, too large for indoor display, had been tacked to the wall. It depicted simply an enormous face, more than a metre wide: the face of a man of about forty-five, with a heavy black moustache and ruggedly handsome features.</span><br>
    <br>
    <span class="log-time">[10:23:48]</span> <span class="log-info">WARN</span>  <span class="log-text">Winston made for the stairs. It was no use trying the lift. Even at the best of times it was seldom working, and at present the electric current was cut off during daylight hours.</span><br>
`;

// Initialization
function init() {
    // Load from local storage or set defaults
    const savedData = localStorage.getItem('fishing_book_v2_1');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            appState.books = parsed.books || [];
            appState.currentBookId = parsed.currentBookId || null;
        } catch (e) {
            console.error('Failed to load saved data', e);
        }
    }

    // If no books, add default
    if (appState.books.length === 0) {
        const newBook = {
            id: '001',
            name: '1984.log',
            content: defaultBookHtml,
            progress: '15%'
        };
        appState.books.push(newBook);
        appState.currentBookId = '001';
    }

    // Ensure valid currentBookId
    if (appState.books.length > 0 && !appState.currentBookId) {
        appState.currentBookId = appState.books[0].id;
    }

    // Determine initial view
    if (appState.books.length === 0) {
        appState.view = 'library';
    } else {
        appState.view = 'reader';
    }

    render();
}

function saveData() {
    localStorage.setItem('fishing_book_v2_1', JSON.stringify({
        books: appState.books,
        currentBookId: appState.currentBookId
    }));
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
        // SVG Icon for Book/Reader
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
        // SVG Icon for Library
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
                <span class="book-id">${book.id}</span>
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
        contentArea.innerHTML = '<div class="empty-state">No book selected. Go to Library.</div>';
        return;
    }
    contentArea.innerHTML = book.content;
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
             // Generate static timestamp at load time
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

// Global Actions (exposed to window for HTML onclick)
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

window.triggerAddBook = function() {
    fileInput.click();
}

window.deleteBook = function(id, event) {
    event.stopPropagation();
    if (confirm('Delete this book?')) {
        appState.books = appState.books.filter(b => b.id !== id);
        if (appState.currentBookId === id) {
            appState.currentBookId = appState.books.length > 0 ? appState.books[0].id : null;
        }
        saveData();
        render();
    }
}

// Event Listeners
if (libraryBtn) {
    libraryBtn.addEventListener('click', toggleLibrary);
}

// Window Control Listeners
if (pinBtn) {
    pinBtn.addEventListener('click', () => {
        appState.isPinned = !appState.isPinned;
        pinBtn.classList.toggle('active', appState.isPinned);
        // Simulate Electron IPC
        console.log('[Mock IPC] toggle-always-on-top:', appState.isPinned);
        // Visual feedback
        if (appState.isPinned) {
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
    });
}

if (minBtn) {
    minBtn.addEventListener('click', () => {
        console.log('[Mock IPC] minimize-window');
        // Minimize simulation not really visible in browser, but we log it
    });
}

if (maxBtn) {
    maxBtn.addEventListener('click', () => {
        appState.isMaximized = !appState.isMaximized;
        console.log('[Mock IPC] toggle-maximize:', appState.isMaximized);
        
        if (appState.isMaximized) {
            appWindow.style.width = '100%';
            appWindow.style.height = '100%';
            appWindow.style.top = '0';
            appWindow.style.left = '0';
            appWindow.style.transform = 'none';
            appWindow.style.borderRadius = '0';
            
            // Change icon to Restore
            maxBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 5v9h9V5H3zm8 8H4V6h7v7z"/>
                <path d="M5 5h1V4h7v7h-1v1h2V3H5v2z"/>
            </svg>`;
        } else {
            appWindow.style.width = '800px';
            appWindow.style.height = '600px';
            appWindow.style.top = '50%';
            appWindow.style.left = '50%';
            appWindow.style.transform = 'translate(-50%, -50%)';
            appWindow.style.borderRadius = '6px';
            
            // Change icon to Maximize
            maxBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 3v10h10V3H3zm9 9H4V4h8v8z"/>
            </svg>`;
        }
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        console.log('[Mock IPC] close-window');
        appWindow.style.display = 'none';
        setTimeout(() => {
            if(confirm('App closed (simulation). Reload to restart?')) {
                location.reload();
            } else {
                appWindow.style.display = 'flex';
            }
        }, 500);
    });
}

if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
        const val = e.target.value / 100;
        appWindow.style.backgroundColor = `rgba(30, 30, 30, ${val})`;
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const newId = String(Date.now()).slice(-4); // Simple unique ID
            
            const formattedHtml = formatTextToLog(text, file.name);
            
            const newBook = {
                id: newId,
                name: file.name,
                content: formattedHtml, 
                progress: '0%'
            };
            
            appState.books.push(newBook);
            appState.currentBookId = newId;
            appState.view = 'reader'; // Auto open
            saveData();
            render();
            
            fileInput.value = '';
        };
        reader.readAsText(file);
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
