// SuperReddit Offscreen Document
// Keeps the Reddit chat iframe alive so the content script can scrape continuously.
// Sends a heartbeat to the service worker to prevent Chrome from killing this document.

const HEARTBEAT_INTERVAL = 20_000; // 20 seconds

// Send periodic heartbeat to keep the offscreen document alive
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_HEARTBEAT' }).catch(() => {
    // Service worker might be inactive, that's ok
  });
}, HEARTBEAT_INTERVAL);

// Monitor iframe load status
const frame = document.getElementById('chatFrame');
if (frame) {
  frame.addEventListener('load', () => {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_FRAME_LOADED' }).catch(() => {});
  });

  frame.addEventListener('error', () => {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_FRAME_ERROR' }).catch(() => {});
  });
}
