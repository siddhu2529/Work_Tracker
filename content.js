// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
        sendResponse({
            title: document.title,
            url: window.location.href
        });
    }
    return true;
});

// Create floating extension
function createFloatingExtension() {
    // Check if extension already exists
    if (document.getElementById('work-tracker-extension')) {
        return;
    }

    const extension = document.createElement('div');
    extension.id = 'work-tracker-extension';
    extension.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        transition: transform 0.2s;
    `;

    extension.innerHTML = `
        <div id="work-tracker-header" style="
            background: #4F46E5;
            color: white;
            padding: 12px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div style="
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="
                    min-width: 16px;
                ">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <div id="work-tracker-title" style="
                    font-size: 14px;
                    font-weight: 500;
                ">Work Tracker</div>
            </div>
            <div id="work-tracker-timer" style="
                font-family: monospace;
                font-size: 16px;
            ">00:00:00</div>
            <button id="work-tracker-minimize" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 4px;
                font-size: 16px;
            ">−</button>
        </div>
        <div id="work-tracker-content" style="
            padding: 12px;
            max-height: 400px;
            overflow-y: auto;
        ">
            <div id="work-tracker-task" style="
                font-size: 13px;
                color: #374151;
                margin-bottom: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            "></div>
            <div id="work-tracker-controls" style="
                display: flex;
                gap: 8px;
                margin-top: 8px;
            ">
                <button id="work-tracker-start" style="
                    flex: 1;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    background: #10B981;
                    color: white;
                    transition: background-color 0.2s;
                ">Start</button>
                <button id="work-tracker-stop" style="
                    flex: 1;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    background: #EF4444;
                    color: white;
                    opacity: 0.5;
                    cursor: not-allowed;
                    transition: background-color 0.2s;
                " disabled>Stop</button>
                <button id="work-tracker-reset" style="
                    flex: 1;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    background: #6B7280;
                    color: white;
                    transition: background-color 0.2s;
                ">Reset</button>
            </div>
        </div>
    `;

    // Add to body
    document.body.appendChild(extension);

    // Make the extension draggable
    const header = extension.querySelector('#work-tracker-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.id === 'work-tracker-minimize') return;
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === header) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, extension);
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    // Minimize/Maximize functionality
    const minimizeBtn = extension.querySelector('#work-tracker-minimize');
    minimizeBtn.addEventListener('click', () => {
        const isMinimized = extension.classList.toggle('work-tracker-minimized');
        minimizeBtn.textContent = isMinimized ? '+' : '−';
        if (isMinimized) {
            extension.style.width = 'auto';
            extension.style.height = '40px';
            extension.querySelector('#work-tracker-content').style.display = 'none';
        } else {
            extension.style.width = '300px';
            extension.style.height = 'auto';
            extension.querySelector('#work-tracker-content').style.display = 'block';
        }
    });

    // Timer controls
    const startBtn = extension.querySelector('#work-tracker-start');
    const stopBtn = extension.querySelector('#work-tracker-stop');
    const timerDisplay = extension.querySelector('#work-tracker-timer');
    const taskDisplay = extension.querySelector('#work-tracker-task');

    // Initialize timer state
    chrome.storage.local.get(['isRunning', 'startTime', 'elapsedTime', 'task'], (data) => {
        if (data.isRunning) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            updateTimerDisplay(data.elapsedTime);
            startTimerUpdate();
        }
        if (data.task) {
            taskDisplay.textContent = data.task;
        }
    });

    // Timer update interval
    let timerUpdateInterval;

    function startTimerUpdate() {
        if (timerUpdateInterval) {
            clearInterval(timerUpdateInterval);
        }
        
        timerUpdateInterval = setInterval(async () => {
            const timerState = await chrome.storage.local.get(['isRunning', 'startTime', 'elapsedTime']);
            if (timerState.isRunning) {
                const currentTime = Date.now();
                const elapsedTime = currentTime - timerState.startTime;
                updateTimerDisplay(elapsedTime);
            } else {
                stopTimerUpdate();
            }
        }, 1000);
    }

    function stopTimerUpdate() {
        if (timerUpdateInterval) {
            clearInterval(timerUpdateInterval);
            timerUpdateInterval = null;
        }
    }

    function updateTimerDisplay(elapsedTime) {
        const hours = Math.floor(elapsedTime / 3600000);
        const minutes = Math.floor((elapsedTime % 3600000) / 60000);
        const seconds = Math.floor((elapsedTime % 60000) / 1000);
        timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Button event listeners
    startBtn.addEventListener('click', () => {
        if (!taskDisplay.textContent.trim()) {
            alert('Please enter a task before starting the timer.');
            return;
        }
        chrome.runtime.sendMessage({ action: 'startTimer' });
        startBtn.disabled = true;
        stopBtn.disabled = false;
        startTimerUpdate();
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopTimer' });
        startBtn.disabled = false;
        stopBtn.disabled = true;
        stopTimerUpdate();
    });

    // Add reset button functionality
    const resetBtn = extension.querySelector('#work-tracker-reset');
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the timer? This will clear the current time.')) {
            chrome.runtime.sendMessage({ action: 'resetTimer' });
            startBtn.disabled = false;
            stopBtn.disabled = true;
            stopTimerUpdate();
            updateTimerDisplay(0);
        }
    });

    // Listen for timer updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'timerUpdate') {
            updateTimerDisplay(message.elapsedTime);
        } else if (message.action === 'timerReset') {
            updateTimerDisplay(0);
            startBtn.disabled = false;
            stopBtn.disabled = true;
            stopTimerUpdate();
        }
    });
}

// Initialize floating extension when the page loads
window.addEventListener('load', () => {
    createFloatingExtension();
});

// Also try to initialize immediately in case the page is already loaded
if (document.readyState === 'complete') {
    createFloatingExtension();
} 