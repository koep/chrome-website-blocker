# Website Blocker — Chrome Extension

A minimalistic Chrome extension that blocks distracting websites and helps you stay focused with an integrated Pomodoro timer.

## Features

- **Block any website** by domain (e.g. `reddit.com`, `twitter.com`)
- **Pomodoro Timer**: Blocked sites display an active 25/5 timer to structure your focus sessions
- **Start/Pause/Reset**: Full control over your work sessions
- **Auto-transitions**: Automatically cycles between work (25 min) and break (5 min) periods
- **Multi-tab sync**: Timer state syncs across all blocked page tabs
- **Dark mode support**: Beautiful UI in both light and dark themes
- **Blocklist syncs** across Chrome browsers via `chrome.storage.sync`
- **Zero build step** — plain HTML, CSS, and JavaScript

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select this project folder
5. The extension icon will appear in your toolbar

## Usage

### Blocking Sites

1. Click the extension icon in the toolbar to open the popup
2. Type a domain (e.g. `reddit.com`) and click **Block**
3. The site is now blocked — visiting it will show the Pomodoro timer page
4. To unblock a site, click the **x** button next to it in the popup

### Using the Pomodoro Timer

When you visit a blocked site, you'll see:

1. **Timer Display**: Shows 25:00 (25 minutes) by default
2. **Start Button**: Click to begin your focus session
3. **Work Session**: Timer counts down for 25 minutes
4. **Break Time**: Automatically starts a 5-minute break
5. **Repeat**: Cycles between work and break periods

**Controls**:
- **Start**: Begin or resume the timer
- **Pause**: Temporarily stop the timer
- **Reset**: Return to the starting state (25:00)

See [USER_GUIDE.md](USER_GUIDE.md) for detailed instructions.

## How It Works

The extension uses Chrome's `declarativeNetRequest` API (Manifest V3) to intercept navigation requests to blocked domains and redirect them to a built-in blocked page.

**Blocking**: Rules are updated dynamically whenever you add or remove a site.

**Timer**: The Pomodoro timer uses `chrome.alarms` API for accurate 1-second ticks and `chrome.storage.local` to sync state across all tabs. When the timer is running, all blocked page tabs display the same countdown in real-time.

## Project Structure

```
├── manifest.json               # Extension manifest (MV3)
├── background.js               # Service worker — blocking rules + timer logic
├── popup.html                  # Popup UI markup
├── popup.css                   # Popup styles
├── popup.js                    # Popup logic (add/remove sites)
├── blocked.html                # Blocked page with Pomodoro timer
├── blocked.css                 # Blocked page styles (timer UI)
├── blocked.js                  # Timer display and controls
├── icons/                      # Extension icons (16, 48, 128px)
├── README.md                   # This file
├── USER_GUIDE.md               # Detailed usage instructions
├── TESTING.md                  # Test documentation
└── IMPLEMENTATION_SUMMARY.md   # Technical implementation details
```

## Documentation

- **[USER_GUIDE.md](USER_GUIDE.md)** - How to use the Pomodoro timer feature
- **[TESTING.md](TESTING.md)** - Comprehensive test cases and results
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical implementation details

## License

This project is released into the public domain under [The Unlicense](https://unlicense.org/). You can do whatever you want with it.
