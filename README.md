# Website Blocker — Chrome Extension

A minimalistic Chrome extension that blocks distracting websites so you can stay focused and productive.

## Features

- Block any website by domain (e.g. `reddit.com`, `twitter.com`)
- Blocked sites show a motivational "Stay Focused" page with rotating quotes
- Blocklist syncs across Chrome browsers via `chrome.storage.sync`
- Zero build step — plain HTML, CSS, and JavaScript

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select this project folder
5. The extension icon will appear in your toolbar

## Usage

1. Click the extension icon in the toolbar to open the popup
2. Type a domain (e.g. `reddit.com`) and click **Block**
3. The site is now blocked — visiting it will show a motivational redirect page
4. To unblock a site, click the **x** button next to it in the popup

## How It Works

The extension uses Chrome's `declarativeNetRequest` API (Manifest V3) to intercept navigation requests to blocked domains and redirect them to a built-in blocked page. Rules are updated dynamically whenever you add or remove a site.

## Project Structure

```
├── manifest.json    # Extension manifest (MV3)
├── background.js    # Service worker — syncs blocking rules
├── popup.html       # Popup UI markup
├── popup.css        # Popup styles
├── popup.js         # Popup logic (add/remove sites)
├── blocked.html     # "Stay Focused" redirect page
├── blocked.css      # Blocked page styles
└── icons/           # Extension icons (16, 48, 128px)
```

## License

This project is released into the public domain under [The Unlicense](https://unlicense.org/). You can do whatever you want with it.
