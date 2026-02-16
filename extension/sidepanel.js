// SuperReddit Side Panel — Status indicator for the embedded Reddit chat
// The reddit-content.js content script runs inside the iframe (all_frames: true)
// and handles all scanning. This script just shows live status.

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const countBadge = document.getElementById('countBadge');

function updateStatus() {
  chrome.storage.local.get(['sr_chat_usernames', 'sr_chat_replies'], (result) => {
    const usernames = result.sr_chat_usernames || [];
    const replies = result.sr_chat_replies || [];

    if (usernames.length === 0) {
      statusDot.className = 'status-dot scanning';
      statusText.textContent = 'Scanning chats...';
      countBadge.textContent = '';
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Live sync active';
      const parts = [`${usernames.length} chats`];
      if (replies.length > 0) parts.push(`${replies.length} replies`);
      countBadge.textContent = parts.join(' · ');
    }
  });
}

// Update every 3s to stay in sync with content script scanning
updateStatus();
setInterval(updateStatus, 3000);

// Also listen for storage changes for instant updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.sr_chat_usernames || changes.sr_chat_replies) {
    updateStatus();
  }
});
