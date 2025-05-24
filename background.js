// Timer state
let timerState = {
    isRunning: false,
    startTime: null,
    elapsedTime: 0
};

// Initialize timer state from storage
chrome.storage.local.get(['isRunning', 'startTime', 'elapsedTime'], (data) => {
    if (data.isRunning) {
        timerState = {
            isRunning: true,
            startTime: data.startTime,
            elapsedTime: data.elapsedTime
        };
        startTimer();
    }
});

// Timer functions
function startTimer() {
    if (!timerState.isRunning) {
        timerState.isRunning = true;
        timerState.startTime = Date.now() - timerState.elapsedTime;
        chrome.storage.local.set({
            isRunning: true,
            startTime: timerState.startTime,
            elapsedTime: timerState.elapsedTime
        });
        updateTimer();
    }
}

function stopTimer() {
    if (timerState.isRunning) {
        timerState.isRunning = false;
        timerState.elapsedTime = Date.now() - timerState.startTime;
        chrome.storage.local.set({
            isRunning: false,
            elapsedTime: timerState.elapsedTime
        });
    }
}

function resetTimer() {
    timerState = {
        isRunning: false,
        startTime: null,
        elapsedTime: 0
    };
    chrome.storage.local.set({
        isRunning: false,
        startTime: null,
        elapsedTime: 0
    });
    chrome.runtime.sendMessage({ action: 'timerReset' });
}

function updateTimer() {
    if (timerState.isRunning) {
        const currentTime = Date.now();
        timerState.elapsedTime = currentTime - timerState.startTime;
        chrome.storage.local.set({
            elapsedTime: timerState.elapsedTime
        });
        setTimeout(updateTimer, 1000);
    }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message in background:', message);
    
    switch (message.action) {
        case 'startTimer':
            startTimer();
            sendResponse({ success: true });
            break;

        case 'stopTimer':
            stopTimer();
            sendResponse({ success: true });
            break;

        case 'resetTimer':
            resetTimer();
            sendResponse({ success: true });
            break;

        case 'getTimerState':
            if (timerState.isRunning) {
                timerState.elapsedTime = Date.now() - timerState.startTime;
            }
            sendResponse(timerState);
            break;

        case 'updateReminderSettings':
            updateReminderSettings(message.settings);
            sendResponse({ success: true });
            break;

        case 'generateSummary':
            console.log('Generating summary with data:', message);
            generateSummary(message.notes, message.duration, message.apiKey, message.task, message.tabs)
                .then(result => {
                    console.log('Summary generation result:', result);
                    sendResponse(result);
                })
                .catch(error => {
                    console.error('Summary generation error:', error);
                    sendResponse({ error: error.message });
                });
            return true; // Keep the message channel open for async response
    }
});

// Update reminder settings
function updateReminderSettings(settings) {
    // Clear existing alarms
    chrome.alarms.clearAll(() => {
        // Set weekly reminder
        const weeklyAlarm = {
            periodInMinutes: 7 * 24 * 60, // 7 days
            when: getNextReminderTime(settings.reminderTime, settings.weekStart)
        };
        chrome.alarms.create('weeklyReminder', weeklyAlarm);

        // Set daily reminder if enabled
        if (settings.dailyReminderEnabled) {
            const dailyAlarm = {
                periodInMinutes: 24 * 60, // 24 hours
                when: getNextDailyReminderTime(settings.dailyReminderTime)
            };
            chrome.alarms.create('dailyReminder', dailyAlarm);
        }
    });
}

// Calculate next reminder time based on settings
function getNextReminderTime(time, weekStart) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const targetDay = parseInt(weekStart);
    
    // Calculate days until next reminder
    let daysUntilReminder = (targetDay - now.getDay() + 7) % 7;
    if (daysUntilReminder === 0 && now.getHours() >= hours) {
        daysUntilReminder = 7;
    }

    const nextReminder = new Date(now);
    nextReminder.setDate(now.getDate() + daysUntilReminder);
    nextReminder.setHours(hours, minutes, 0, 0);

    return nextReminder.getTime();
}

// Calculate next daily reminder time
function getNextDailyReminderTime(time) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const nextReminder = new Date(now);
    
    nextReminder.setHours(hours, minutes, 0, 0);
    if (now > nextReminder) {
        nextReminder.setDate(nextReminder.getDate() + 1);
    }

    return nextReminder.getTime();
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'weeklyReminder') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Weekly Timesheet Reminder',
            message: 'Don\'t forget to fill in your timesheet for this week.',
            priority: 2
        });
    } else if (alarm.name === 'dailyReminder') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Daily Work Tracker Reminder',
            message: 'Time to start tracking your work for today!',
            priority: 2
        });
    }
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
    // Initialize storage
    chrome.storage.local.set({
        isRunning: false,
        elapsedTime: 0,
        notes: '',
        history: []
    });

    // Set default settings
    chrome.storage.sync.set({
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        weekStart: '1',
        reminderTime: '17:00',
        dailyReminderEnabled: false,
        dailyReminderTime: '09:00'
    });
});

// Timer update interval
setInterval(() => {
    if (timerState.isRunning) {
        const now = Date.now();
        timerState.elapsedTime = now - timerState.startTime;
        // Broadcast timer update to all extension views
        chrome.runtime.sendMessage({
            action: 'timerUpdate',
            elapsedTime: timerState.elapsedTime
        });
    }
}, 1000);

// Calculate next Friday at 5 PM
function getNextFriday5PM() {
    const now = new Date();
    const daysUntilFriday = (5 - now.getDay() + 7) % 7;
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(17, 0, 0, 0); // 5 PM
    
    if (now > nextFriday) {
        nextFriday.setDate(nextFriday.getDate() + 7);
    }
    
    return nextFriday.getTime();
}

// Update reminder time
function updateReminderTime(hour) {
    chrome.alarms.clear('weeklyReminder', () => {
        chrome.alarms.create('weeklyReminder', {
            periodInMinutes: 7 * 24 * 60,
            when: getNextFridayAtHour(hour)
        });
    });
}

// Calculate next Friday at specified hour
function getNextFridayAtHour(hour) {
    const now = new Date();
    const daysUntilFriday = (5 - now.getDay() + 7) % 7;
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(parseInt(hour), 0, 0, 0);
    
    if (now > nextFriday) {
        nextFriday.setDate(nextFriday.getDate() + 7);
    }
    
    return nextFriday.getTime();
}

async function generateSummary(notes, duration, apiKey, task, tabs) {
    try {
        const prompt = `Please provide a concise, 4-line summary of the following work session. Write it as a continuous narrative without any line numbers or headings:

Task Details:
- Task ID: ${task}
- Duration: ${duration}
- Notes: ${notes}
- Related Tabs: ${tabs}

Guidelines for the summary:
- First line: Current status and actual work performed
- Second line: Key activities or findings
- Third line: Next steps or transition plan
- Fourth line: Any critical notes or dependencies

Keep the summary:
- Professional and clear
- Honest about work performed
- Focused on actual status
- Free of line numbers or headings
- Written as a continuous narrative`;

        console.log('Sending request to Gemini API...');
        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('API Error Response:', error);
            throw new Error(error.error?.message || 'Failed to generate summary');
        }

        const data = await response.json();
        console.log('Raw API Response:', JSON.stringify(data, null, 2));

        // Extract the summary text from the response
        let summaryText;
        try {
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                summaryText = data.candidates[0].content.parts[0].text;
                console.log('Found summary in candidates:', summaryText);
            } else if (data.text) {
                summaryText = data.text;
                console.log('Found summary in text:', summaryText);
            } else {
                console.error('Unexpected API Response Structure:', JSON.stringify(data, null, 2));
                throw new Error('Unexpected response format from API');
            }
        } catch (parseError) {
            console.error('Error parsing API response:', parseError);
            throw new Error('Failed to parse API response');
        }

        if (!summaryText) {
            console.error('No summary text found in response');
            throw new Error('No summary text found in API response');
        }

        console.log('Final summary text:', summaryText);
        return { summary: summaryText };
    } catch (error) {
        console.error('Error in generateSummary:', error);
        throw error;
    }
} 