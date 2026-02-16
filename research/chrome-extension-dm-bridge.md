# Chrome Extension DM Bridge

## Overview

A Chrome extension that enables seamless Reddit DM sending directly from the SuperReddit app — no tab switching, no OAuth, no manual copy-paste. The extension runs as a background service worker that uses the user's existing Reddit session cookies to send messages via Reddit's internal API.

## User Experience

1. User clicks **"Send DM"** on a lead card in the Kanban pipeline
2. App sends a message to the Chrome extension
3. Extension sends the Reddit DM in the background using session cookies
4. Extension reports success/failure back to the app
5. Card moves from "Ready to DM" → "DM Sent" automatically
6. User sees a success toast — never leaves the page

## Architecture

```
SuperReddit App (website)
  ↕ window.postMessage / chrome.runtime.sendMessage
Chrome Extension (background service worker)
  ↕ fetch with Reddit session cookies
Reddit (no OAuth, no tabs, no redirects)
```

## Extension Components

### 1. Manifest (manifest.json — Manifest V3)
- `permissions`: `cookies`, `activeTab`
- `host_permissions`: `https://www.reddit.com/*`, `https://old.reddit.com/*`
- `background.service_worker`: handles DM sending
- `content_scripts`: injected on the SuperReddit app domain to relay messages

### 2. Background Service Worker (background.js)
- Listens for messages from the content script
- Sends Reddit DMs via `fetch` using session cookies
- Reddit internal compose endpoint: `POST https://www.reddit.com/api/compose`
  - Body: `to=USERNAME&subject=SUBJECT&text=BODY&api_type=json`
  - Uses existing Reddit session (cookies auto-attached for reddit.com origin)
- Handles rate limiting (queue with 30-90s delays between sends)
- Polls Reddit inbox for reply detection

### 3. Content Script (content.js)
- Injected on the SuperReddit app pages
- Bridges communication between the web app and the background worker
- Relays messages via `chrome.runtime.sendMessage`

### 4. Connection Status
- Extension sends heartbeat to the app confirming it's installed + Reddit is logged in
- App shows a small "Reddit connected" / "Extension not detected" indicator

## Message Protocol

### App → Extension

```json
// Send a single DM
{
  "type": "SEND_DM",
  "payload": {
    "dmId": "uuid",
    "to": "reddit_username",
    "subject": "Subject line",
    "body": "DM body text"
  }
}

// Send bulk DMs (queued with delays)
{
  "type": "SEND_BULK_DMS",
  "payload": {
    "dms": [
      { "dmId": "uuid", "to": "username", "subject": "...", "body": "..." }
    ],
    "delayMs": 60000
  }
}

// Check connection status
{
  "type": "CHECK_STATUS"
}

// Poll inbox for replies
{
  "type": "CHECK_INBOX"
}
```

### Extension → App

```json
// DM sent successfully
{
  "type": "DM_SENT",
  "payload": { "dmId": "uuid", "success": true }
}

// DM send failed
{
  "type": "DM_FAILED",
  "payload": { "dmId": "uuid", "error": "rate_limited" }
}

// Connection status
{
  "type": "STATUS",
  "payload": { "installed": true, "redditLoggedIn": true, "username": "your_username" }
}

// Reply detected
{
  "type": "REPLY_DETECTED",
  "payload": { "from": "reddit_username", "subject": "...", "snippet": "..." }
}
```

## App-Side Integration

### New Components

1. **`RedditBridge`** — singleton hook/context that manages extension communication
   - `useRedditBridge()` returns `{ connected, redditUsername, sendDm, sendBulkDms, checkInbox }`
   - Shows connection banner if extension not installed
   - Falls back to current copy-and-open behavior if extension unavailable

2. **Updated `KanbanLeadCard`** — "Send DM" button uses bridge when available
   - Connected: click → send via extension → auto-advance card
   - Not connected: click → open DmDraftBuilder dialog (current behavior)

3. **Updated `DmDraftBuilder`** — adds "Send via Extension" button alongside "Copy & Open DM"
   - Only visible when extension is connected

4. **`ExtensionStatusIndicator`** — small badge in header or toolbar
   - Green dot: extension connected, Reddit logged in
   - Yellow dot: extension installed, Reddit not logged in
   - Hidden: extension not installed (show install prompt in toolbar)

## Features

### Phase 1: Core DM Sending
- [ ] Chrome extension with manifest v3
- [ ] Background service worker for sending DMs
- [ ] Content script bridge for app ↔ extension communication
- [ ] Single DM send from Kanban card
- [ ] Connection status indicator
- [ ] Fallback to copy-and-open when extension unavailable

### Phase 2: Bulk & Automation
- [ ] Bulk DM queue with configurable delays
- [ ] Send progress indicator (3/10 sent...)
- [ ] Rate limit detection and backoff
- [ ] Retry failed sends

### Phase 3: Inbox Monitoring
- [ ] Periodic inbox polling (every 5 min)
- [ ] Auto-detect replies to sent DMs
- [ ] Auto-advance cards from "DM Sent" → "Follow Up"
- [ ] Desktop notifications for replies

### Phase 4: Polish
- [ ] Chrome Web Store listing
- [ ] Install prompt in-app for new users
- [ ] Send analytics (open rate proxy via tracked links)
- [ ] Extension popup with queue status

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Reddit rate limiting | DMs fail silently | Queue with 30-90s random delays, max 20/hour |
| Reddit DOM/API changes | Extension breaks | Version pin, monitor for changes, quick-patch pipeline |
| Reddit detects automation | Account suspension | Human-like delays, randomized timing, limit volume |
| Chrome Web Store rejection | Can't distribute | Distribute as unpacked extension or via direct download |
| User not logged into Reddit | DMs fail | Check session before sending, show "log in to Reddit" prompt |

## Reddit Internal API Reference

### Send Message
```
POST https://www.reddit.com/api/compose
Content-Type: application/x-www-form-urlencoded

to=USERNAME&subject=SUBJECT&text=BODY&api_type=json
```
Requires: Reddit session cookies (auto-attached by Chrome for reddit.com origin from background worker)

### Check Inbox
```
GET https://www.reddit.com/message/inbox.json?limit=25
```
Returns: JSON array of inbox messages with author, subject, body, timestamp

## Implementation Plan

1. **Branch**: `feature/chrome-extension-dm-bridge`
2. **Directory**: `/extension/` at repo root
3. **App changes**: minimal — add bridge hook + update send buttons
4. **Testing**: manual with unpacked extension in Chrome dev mode
