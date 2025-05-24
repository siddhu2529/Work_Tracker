// DOM Elements
const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const notesTextarea = document.getElementById('notes');
const taskInput = document.getElementById('taskInput');
const generateSummaryBtn = document.getElementById('generateSummaryBtn');
const summaryContent = document.getElementById('summary');
const historyList = document.getElementById('history-list');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const dateFormatSelect = document.getElementById('dateFormat');
const timeFormatSelect = document.getElementById('timeFormat');
const weekStartSelect = document.getElementById('weekStart');
const reminderTimeInput = document.getElementById('reminderTime');
const dailyReminderToggle = document.getElementById('dailyReminderToggle');
const dailyReminderTimeInput = document.getElementById('dailyReminderTime');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// State
let timerInterval;
let startTime;
let elapsedTime = 0;
let isRunning = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const settings = await chrome.storage.sync.get([
    'dateFormat',
    'timeFormat',
    'weekStart',
    'reminderTime',
    'dailyReminderEnabled',
    'dailyReminderTime',
    'geminiApiKey'
  ]);

  // Set default values if not present
  if (settings.dateFormat) dateFormatSelect.value = settings.dateFormat;
  if (settings.timeFormat) timeFormatSelect.value = settings.timeFormat;
  if (settings.weekStart) weekStartSelect.value = settings.weekStart;
  if (settings.reminderTime) reminderTimeInput.value = settings.reminderTime;
  if (settings.dailyReminderEnabled) {
    dailyReminderToggle.checked = settings.dailyReminderEnabled;
    document.querySelector('.daily-reminder-time').style.display = 'block';
  }
  if (settings.dailyReminderTime) dailyReminderTimeInput.value = settings.dailyReminderTime;
  if (settings.geminiApiKey) geminiApiKeyInput.value = settings.geminiApiKey;

  // Load timer state
  const timerState = await chrome.storage.local.get(['isRunning', 'startTime', 'elapsedTime']);
  if (timerState.isRunning) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    updateTimerDisplay(timerState.elapsedTime);
    // Start the timer update interval
    startTimerUpdate();
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    updateTimerDisplay(timerState.elapsedTime || 0);
  }

  // Load notes
  const notes = await chrome.storage.local.get('notes');
  if (notes.notes) notesTextarea.value = notes.notes;

  // Load history
  loadHistory();

  // Load saved task and notes
  const savedData = await chrome.storage.local.get(['task', 'notes']);
  if (savedData.task) taskInput.value = savedData.task;
  if (savedData.notes) notesTextarea.value = savedData.notes;

  // Save task and notes when changed
  taskInput.addEventListener('change', () => {
    chrome.storage.local.set({ task: taskInput.value });
  });

  notesTextarea.addEventListener('change', () => {
    chrome.storage.local.set({ notes: notesTextarea.value });
  });

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Daily reminder toggle
  dailyReminderToggle.addEventListener('change', () => {
    document.querySelector('.daily-reminder-time').style.display = 
      dailyReminderToggle.checked ? 'block' : 'none';
  });

  // Timer controls
  startBtn.addEventListener('click', () => {
    if (!taskInput.value.trim()) {
      alert('Please enter your task before starting the timer.');
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

  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the timer? This will clear the current time.')) {
      chrome.runtime.sendMessage({ action: 'resetTimer' });
      startBtn.disabled = false;
      stopBtn.disabled = true;
      stopTimerUpdate();
      updateTimerDisplay(0);
    }
  });

  // Timer update
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'timerUpdate') {
      updateTimerDisplay(message.elapsedTime);
    }
  });

  // Generate summary
  generateSummaryBtn.addEventListener('click', async () => {
    const notes = notesTextarea.value;
    if (!notes) {
      alert('Please add some notes before generating a summary.');
      return;
    }

    const apiKey = await chrome.storage.sync.get('geminiApiKey');
    if (!apiKey.geminiApiKey) {
      alert('Please set your Gemini API key in the settings tab.');
      return;
    }

    // Get current tabs
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tabTitles = tabs.map(tab => tab.title).join(', ');

    // Get timer state
    const timerState = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getTimerState' }, resolve);
    });

    const duration = formatDuration(timerState.elapsedTime);
    const task = taskInput.value;

    generateSummaryBtn.disabled = true;
    generateSummaryBtn.textContent = 'Generating...';

    try {
      console.log('Sending message to background script...');
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'generateSummary',
          notes: notes,
          duration: duration,
          task: task,
          tabs: tabTitles,
          apiKey: apiKey.geminiApiKey
        }, response => {
          console.log('Received response from background:', response);
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.error) {
            console.error('Response error:', response.error);
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      console.log('Processing response:', response);

      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format from summary generation');
      }

      const summaryText = response.summary;
      console.log('Extracted summary text:', summaryText);

      if (typeof summaryText === 'string' && summaryText.trim()) {
        console.log('Setting summary content...');
        summaryContent.textContent = summaryText;
        summaryContent.classList.remove('hidden');
        saveToHistory(notes, summaryText);
      } else {
        throw new Error('Invalid summary text in response');
      }
    } catch (error) {
      console.error('Summary Generation Error:', error);
      alert('Error generating summary: ' + error.message);
      summaryContent.textContent = 'Error: ' + error.message;
      summaryContent.classList.remove('hidden');
    } finally {
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.textContent = 'Generate Summary';
    }
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', async () => {
    const settings = {
      dateFormat: dateFormatSelect.value,
      timeFormat: timeFormatSelect.value,
      weekStart: weekStartSelect.value,
      reminderTime: reminderTimeInput.value,
      dailyReminderEnabled: dailyReminderToggle.checked,
      dailyReminderTime: dailyReminderTimeInput.value,
      geminiApiKey: geminiApiKeyInput.value
    };
    
    try {
      await chrome.storage.sync.set(settings);
      await chrome.runtime.sendMessage({ 
        action: 'updateReminderSettings',
        settings: settings
      });
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Error saving settings: ' + error.message);
    }
  });
});

// Timer update functions
let timerUpdateInterval;

function startTimerUpdate() {
  // Clear any existing interval
  if (timerUpdateInterval) {
    clearInterval(timerUpdateInterval);
  }
  
  // Update timer every second
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

// Timer functions
function startTimer() {
  if (!isRunning) {
    isRunning = true;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimer, 1000);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    chrome.storage.local.set({ isRunning: true, startTime });
  }
}

function stopTimer() {
  if (isRunning) {
    isRunning = false;
    clearInterval(timerInterval);
    elapsedTime = Date.now() - startTime;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    chrome.storage.local.set({ isRunning: false, elapsedTime });
    generateSummary();
  }
}

function resetTimer() {
  stopTimer();
  elapsedTime = 0;
  updateTimerDisplay(0);
  chrome.storage.local.set({ elapsedTime: 0 });
}

function updateTimer() {
  const currentTime = Date.now();
  elapsedTime = currentTime - startTime;
  updateTimerDisplay(elapsedTime);
}

// Summary functions
async function generateSummary() {
  const notes = notesTextarea.value;
  if (!notes) {
    summaryContent.textContent = 'Please add some notes before generating a summary.';
    return;
  }

  // Check if API key is set
  const settings = await chrome.storage.sync.get(['geminiApiKey']);
  if (!settings.geminiApiKey) {
    summaryContent.textContent = 'Please set your Gemini API key in the settings tab.';
    return;
  }

  // Send message to background script to generate summary using Gemini AI
  chrome.runtime.sendMessage({ 
    action: 'generateSummary', 
    notes,
    duration: formatDuration(elapsedTime),
    apiKey: settings.geminiApiKey
  }, response => {
    if (response && response.summary) {
      summaryContent.textContent = response.summary;
      saveToHistory(notes, response.summary);
    } else if (response && response.error) {
      summaryContent.textContent = `Error: ${response.error}`;
    }
  });
}

// History functions
async function loadHistory() {
  const history = await chrome.storage.local.get('history');
  if (!history.history) return;

  const settings = await chrome.storage.sync.get(['dateFormat', 'timeFormat']);
  const dateFormat = settings.dateFormat || 'MM/DD/YYYY';
  const timeFormat = settings.timeFormat || '12h';

  historyList.innerHTML = history.history.map((item, index) => {
    const date = new Date(item.timestamp);
    const formattedDate = formatDate(date, dateFormat);
    const formattedTime = formatTime(date, timeFormat);
    
    return `
      <div class="history-item">
        <div class="history-header">
          <span>${formattedDate} ${formattedTime}</span>
          <span>${formatDuration(item.duration)}</span>
        </div>
        <div class="history-notes">${item.notes}</div>
        <div class="history-summary">${item.summary}</div>
      </div>
    `;
  }).join('');
}

function formatDate(date, format) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${month}/${day}/${year}`;
  }
}

function formatTime(date, format) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (format === '12h') {
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function formatDuration(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function saveToHistory(notes, summary) {
  chrome.storage.local.get('history', data => {
    const history = data.history || [];
    history.unshift({
      timestamp: Date.now(),
      duration: elapsedTime,
      notes,
      summary
    });
    chrome.storage.local.set({ history: history.slice(0, 10) });
    loadHistory();
  });
}