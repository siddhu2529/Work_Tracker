# Replicon Time Tracker Extension

A Chrome/Edge extension that helps you track your work time and generate meaningful summaries of your activities.

## Features

- **Stopwatch Mode**: Start, pause, and stop a timer to track your work sessions
- **Smart Summary Generation**: Automatically generates summaries based on your open tabs
- **Notes**: Add custom notes to your time entries
- **History**: View your recent work sessions
- **Export**: Export your time entries to CSV format
- **Weekly Reminders**: Get notified every Friday at 5 PM to update your timesheet

## Installation

1. Clone or download this repository
2. Open Chrome/Edge and go to `chrome://extensions` or `edge://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in your browser toolbar to open the popup
2. Use the timer controls to start tracking your work time:
   - Click "Start" to begin the timer
   - Click "Pause" to pause the timer
   - Click "Stop" to end the session
3. Add notes to your session using the notes text area
4. Click "Generate Summary" to create a summary based on your open tabs
5. View your recent sessions in the history section
6. Export your time entries to CSV using the export function

## Development

The extension is built using:
- HTML/CSS with TailwindCSS for styling
- Vanilla JavaScript for functionality
- Chrome/Edge Extension APIs for browser integration

## File Structure

- `manifest.json`: Extension configuration
- `popup.html`: Main extension popup interface
- `popup.js`: Popup functionality and UI interactions
- `background.js`: Background tasks and reminder system
- `content.js`: Page-specific interactions
- `icons/`: Extension icons

## Contributing

Feel free to submit issues and enhancement requests! 