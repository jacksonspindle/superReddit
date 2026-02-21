// SuperReddit Side Panel — Activity Hub with Quick Compose
// Reads all data from chrome.storage.local (populated by background.js + content scripts)

const STORAGE_KEYS = {
  usernames: 'sr_chat_usernames',
  youSentTo: 'sr_you_sent_to',
  theyReplied: 'sr_they_replied',
  previews: 'sr_chat_previews',
  conversations: 'sr_conversations',
  activityLog: 'sr_activity_log',
};

// ---- DOM refs ----
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statChats = document.getElementById('statChats');
const statSent = document.getElementById('statSent');
const statReplies = document.getElementById('statReplies');
const searchInput = document.getElementById('searchInput');
const conversationList = document.getElementById('conversationList');
const activityList = document.getElementById('activityList');
const composeFab = document.getElementById('composeFab');
const composeModal = document.getElementById('composeModal');
const modalClose = document.getElementById('modalClose');
const composeUsername = document.getElementById('composeUsername');
const composeSubject = document.getElementById('composeSubject');
const composeBody = document.getElementById('composeBody');
const composeSend = document.getElementById('composeSend');
const composeOpenReddit = document.getElementById('composeOpenReddit');
const toast = document.getElementById('toast');

// ---- State ----
let cachedData = {
  usernames: [],
  youSentTo: [],
  theyReplied: [],
  previews: {},
  conversations: {},
  activityLog: [],
};

// ---- Init ----
loadAllData().then(() => {
  renderConversations();
  renderActivity();
  updateStats();
});
checkRedditStatus();
setInterval(checkRedditStatus, 30000);

// ---- Tab Switching ----
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ---- Search ----
searchInput.addEventListener('input', () => {
  renderConversations();
});

// ---- Compose Modal ----
composeFab.addEventListener('click', () => openCompose());
modalClose.addEventListener('click', () => closeCompose());
composeModal.addEventListener('click', (e) => {
  if (e.target === composeModal) closeCompose();
});

composeSend.addEventListener('click', () => handleSend());
composeOpenReddit.addEventListener('click', () => handleOpenOnReddit());

// ---- Storage Change Listener ----
chrome.storage.onChanged.addListener((changes) => {
  let needsRender = false;
  for (const [storageKey, dataKey] of Object.entries({
    [STORAGE_KEYS.usernames]: 'usernames',
    [STORAGE_KEYS.youSentTo]: 'youSentTo',
    [STORAGE_KEYS.theyReplied]: 'theyReplied',
    [STORAGE_KEYS.previews]: 'previews',
    [STORAGE_KEYS.conversations]: 'conversations',
    [STORAGE_KEYS.activityLog]: 'activityLog',
  })) {
    if (changes[storageKey]) {
      cachedData[dataKey] = changes[storageKey].newValue || (Array.isArray(cachedData[dataKey]) ? [] : {});
      needsRender = true;
    }
  }
  if (needsRender) {
    renderConversations();
    renderActivity();
    updateStats();
  }
});

// ---- Data Loading ----

async function loadAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(Object.values(STORAGE_KEYS), (result) => {
      cachedData.usernames = result[STORAGE_KEYS.usernames] || [];
      cachedData.youSentTo = result[STORAGE_KEYS.youSentTo] || [];
      cachedData.theyReplied = result[STORAGE_KEYS.theyReplied] || [];
      cachedData.previews = result[STORAGE_KEYS.previews] || {};
      cachedData.conversations = result[STORAGE_KEYS.conversations] || {};
      cachedData.activityLog = result[STORAGE_KEYS.activityLog] || [];
      resolve();
    });
  });
}

// ---- Reddit Status ----

function checkRedditStatus() {
  chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Error';
      return;
    }
    if (response.redditLoggedIn) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Not logged in';
    }
  });
}

// ---- Stats ----

function updateStats() {
  statChats.textContent = cachedData.usernames.length;
  statSent.textContent = cachedData.youSentTo.length;
  statReplies.textContent = cachedData.theyReplied.length;
}

// ---- Conversations ----

function renderConversations() {
  const query = searchInput.value.trim().toLowerCase();
  const sentSet = new Set(cachedData.youSentTo.map((u) => u.toLowerCase()));
  const repliedSet = new Set(cachedData.theyReplied.map((u) => u.toLowerCase()));

  // Build conversation entries from all known usernames
  let entries = cachedData.usernames.map((username) => {
    const uLower = username.toLowerCase();
    const preview = cachedData.previews[uLower] || null;
    const convo = cachedData.conversations[uLower] || null;

    // Determine status
    let status = 'new';
    if (repliedSet.has(uLower)) status = 'replied';
    else if (sentSet.has(uLower)) status = 'sent';

    // Get last message timestamp
    let lastTimestamp = 0;
    if (convo && convo.messages && convo.messages.length > 0) {
      lastTimestamp = convo.messages[convo.messages.length - 1].timestamp || 0;
    } else if (convo && convo.lastUpdated) {
      lastTimestamp = convo.lastUpdated;
    }

    // Preview text
    let previewText = '';
    if (preview) {
      previewText = preview.fromYou ? 'You: ' + (preview.text || '') : (preview.text || '');
    } else if (convo && convo.messages && convo.messages.length > 0) {
      const lastMsg = convo.messages[convo.messages.length - 1];
      previewText = lastMsg.isFromYou ? 'You: ' + (lastMsg.text || '') : (lastMsg.text || '');
    }

    return { username, uLower, status, lastTimestamp, previewText };
  });

  // Filter by search
  if (query) {
    entries = entries.filter((e) => e.uLower.includes(query));
  }

  // Sort: replied first, then sent, then new. Within each group, most recent first.
  const statusOrder = { replied: 0, sent: 1, new: 2 };
  entries.sort((a, b) => {
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    if (orderDiff !== 0) return orderDiff;
    return b.lastTimestamp - a.lastTimestamp;
  });

  // Render
  if (entries.length === 0) {
    conversationList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#x1f4ac;</div>
        <div class="empty-state-text">${query ? 'No conversations match your search' : 'No conversations yet.<br>Open Reddit chat to start scanning.'}</div>
      </div>
    `;
    return;
  }

  conversationList.innerHTML = entries.map((entry) => `
    <div class="conversation-card" data-username="${escapeHtml(entry.username)}">
      <div class="convo-avatar">${escapeHtml(entry.username.charAt(0))}</div>
      <div class="convo-body">
        <div class="convo-header">
          <span class="convo-username">${escapeHtml(entry.username)}</span>
          <span class="convo-badge ${entry.status}">${entry.status}</span>
        </div>
        <div class="convo-preview">${escapeHtml(truncate(entry.previewText, 60))}</div>
      </div>
      <div class="convo-meta">
        <span class="convo-time">${entry.lastTimestamp ? relativeTime(entry.lastTimestamp) : ''}</span>
      </div>
    </div>
  `).join('');

  // Click handlers
  conversationList.querySelectorAll('.conversation-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const username = card.dataset.username;
      // Ctrl/Cmd+click or middle click for compose
      if (e.ctrlKey || e.metaKey) {
        openCompose(username);
      } else {
        // Open Reddit profile in new tab
        chrome.tabs.create({ url: 'https://www.reddit.com/user/' + encodeURIComponent(username) });
      }
    });
    // Right-click context: compose
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openCompose(card.dataset.username);
    });
  });
}

// ---- Activity Log ----

function renderActivity() {
  const log = cachedData.activityLog;

  if (log.length === 0) {
    activityList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#x1f4cb;</div>
        <div class="empty-state-text">No activity yet.<br>Events will appear here as the extension works.</div>
      </div>
    `;
    return;
  }

  activityList.innerHTML = log.map((entry) => `
    <div class="activity-entry">
      <div class="activity-dot ${escapeHtml(entry.type || 'info')}"></div>
      <div class="activity-message">${escapeHtml(entry.message)}</div>
      <div class="activity-time">${relativeTime(entry.timestamp)}</div>
    </div>
  `).join('');
}

// ---- Compose ----

function openCompose(username) {
  composeModal.classList.add('open');
  composeUsername.value = username || '';
  composeSubject.value = '';
  composeBody.value = '';
  composeSend.disabled = false;
  composeSend.textContent = 'Send';
  if (username) {
    composeSubject.focus();
  } else {
    composeUsername.focus();
  }
}

function closeCompose() {
  composeModal.classList.remove('open');
}

function handleSend() {
  const username = composeUsername.value.trim();
  const subject = composeSubject.value.trim();
  const body = composeBody.value.trim();

  if (!username) { showToast('Enter a username', 'error'); return; }
  if (!subject) { showToast('Enter a subject', 'error'); return; }
  if (!body) { showToast('Enter a message', 'error'); return; }

  composeSend.disabled = true;
  composeSend.textContent = 'Sending...';

  chrome.runtime.sendMessage({
    type: 'SEND_DM',
    data: { username, subject, body },
  }, (response) => {
    if (chrome.runtime.lastError) {
      showToast('Extension error', 'error');
      composeSend.disabled = false;
      composeSend.textContent = 'Send';
      return;
    }
    if (response && response.success) {
      showToast('DM sent to u/' + username, 'success');
      closeCompose();
    } else {
      const err = (response && response.error) || 'Send failed';
      showToast(err, 'error');
      composeSend.disabled = false;
      composeSend.textContent = 'Send';
    }
  });
}

function handleOpenOnReddit() {
  const username = composeUsername.value.trim();
  const subject = composeSubject.value.trim();
  const body = composeBody.value.trim();

  if (!username) { showToast('Enter a username', 'error'); return; }

  const params = new URLSearchParams();
  params.set('to', username);
  if (subject) params.set('subject', subject);
  if (body) params.set('message', body);

  chrome.tabs.create({
    url: 'https://www.reddit.com/message/compose/?' + params.toString(),
  });
  closeCompose();
}

// ---- Toast ----

let toastTimer = null;
function showToast(message, type) {
  toast.textContent = message;
  toast.className = 'toast show ' + (type || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// ---- Helpers ----

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function relativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + 'd';
  const months = Math.floor(days / 30);
  return months + 'mo';
}
