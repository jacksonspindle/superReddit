// SuperReddit DM Bridge — Background Service Worker
// Automatically opens reddit.com/chat in a background tab to scrape chat data.
// The user never needs to manually open the chat tab.

const STORAGE_KEY = 'sr_chat_usernames';
const YOU_SENT_TO_KEY = 'sr_you_sent_to';
const THEY_REPLIED_KEY = 'sr_they_replied';
const PREVIEWS_KEY = 'sr_chat_previews';
const SCAN_READY_KEY = 'sr_scan_ready';

const SCAN_ALARM = 'sr_periodic_scan';
const SCAN_INTERVAL_MINUTES = 5;

// ---- On install: clear stale data & start periodic scanning ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(
    [STORAGE_KEY, YOU_SENT_TO_KEY, THEY_REPLIED_KEY, PREVIEWS_KEY, SCAN_READY_KEY],
    () => {
      console.log('[SR BG] Cleared stale data from previous version');
    }
  );
  // Start periodic scan alarm
  chrome.alarms.create(SCAN_ALARM, { delayInMinutes: 0.5, periodInMinutes: SCAN_INTERVAL_MINUTES });
});

// ---- On browser startup: ensure scanning is active ----
chrome.runtime.onStartup.addListener(() => {
  console.log('[SR BG] Browser started — scheduling chat scan');
  chrome.alarms.create(SCAN_ALARM, { delayInMinutes: 0.5, periodInMinutes: SCAN_INTERVAL_MINUTES });
});

// ---- Periodic alarm: refresh chat data in background ----
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    console.log('[SR BG] Periodic scan — ensuring chat tab is open');
    refreshChatTab();
  }
});

// Refresh the chat tab to trigger a fresh scan by the content script
async function refreshChatTab() {
  try {
    const hasSession = await hasRedditSession();
    if (!hasSession) return; // Not logged in, skip

    const tabId = await ensureChatTab();
    // Reload the tab to trigger a fresh content script scan
    try {
      const tab = await chrome.tabs.get(tabId);
      // Only reload if the tab has been idle for a while (don't interrupt active use)
      if (tab && !tab.active) {
        chrome.tabs.reload(tabId);
        console.log('[SR BG] Refreshed chat tab for periodic scan');
      }
    } catch { /* tab doesn't exist, ensureChatTab will create next time */ }
  } catch (err) {
    console.log('[SR BG] Periodic scan error:', err.message);
  }
}

// ---- Side Panel ----

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ---- Chat Tab Management ----

let chatTabId = null;
let scanResolvers = []; // Promises waiting for scan data

// Find or create a background reddit.com/chat tab
async function ensureChatTab() {
  // Check if our tracked tab still exists
  if (chatTabId !== null) {
    try {
      const tab = await chrome.tabs.get(chatTabId);
      if (tab && tab.url && tab.url.includes('reddit.com/chat')) {
        return chatTabId;
      }
    } catch {
      chatTabId = null;
    }
  }

  // Look for any existing chat tab
  const tabs = await chrome.tabs.query({ url: '*://*.reddit.com/chat*' });
  if (tabs.length > 0) {
    chatTabId = tabs[0].id;
    return chatTabId;
  }

  // Create a new background tab (active: false = doesn't steal focus)
  console.log('[SR BG] Opening reddit.com/chat in background tab');
  const tab = await chrome.tabs.create({
    url: 'https://www.reddit.com/chat',
    active: false,
  });
  chatTabId = tab.id;
  return chatTabId;
}

// Ensure chat data is available — opens tab if needed, waits for scan
async function ensureChatData(timeoutMs = 60_000) {
  // If we already have data, return immediately
  const existing = await getStoredUsernames();
  if (existing.length > 0) {
    return;
  }

  // Open the chat tab
  await ensureChatTab();

  // Wait for the content script to send data (CHAT_SCAN_RESULT)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // Timeout — resolve with whatever we have
      scanResolvers = scanResolvers.filter((r) => r !== resolve);
      resolve();
    }, timeoutMs);

    scanResolvers.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function notifyScanResolvers() {
  const resolvers = [...scanResolvers];
  scanResolvers = [];
  for (const resolve of resolvers) resolve();
}

// ---- Message Handlers ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ---- App bridge queries ----

  if (message.type === 'CHECK_STATUS') {
    handleCheckStatus().then(sendResponse).catch((err) =>
      sendResponse({ installed: true, redditLoggedIn: false, error: err.message })
    );
    return true;
  }

  if (message.type === 'CHECK_SENT_MESSAGES') {
    // Auto-open chat tab if needed, then return data
    ensureChatData(30_000).then(() =>
      handleCheckSentMessages().then(sendResponse)
    ).catch((err) =>
      sendResponse({ usernames: [], error: err.message })
    );
    return true;
  }

  if (message.type === 'CHECK_YOU_SENT_TO') {
    // Return immediately with whatever we have — don't block waiting for chat data.
    // The 2nd reconciliation pass (45s) will catch late-arriving data.
    getStoredYouSentTo().then((usernames) => sendResponse({ usernames }));
    return true;
  }

  if (message.type === 'CHECK_THEY_REPLIED') {
    // Return immediately — same reasoning as CHECK_YOU_SENT_TO
    getStoredTheyReplied().then((usernames) => sendResponse({ usernames }));
    return true;
  }

  if (message.type === 'CHECK_REPLIES') {
    // Legacy — redirect to CHECK_THEY_REPLIED behavior
    ensureChatData(30_000).then(() =>
      getStoredTheyReplied().then((replies) => sendResponse({ replies }))
    ).catch((err) =>
      sendResponse({ replies: [], error: err.message })
    );
    return true;
  }

  if (message.type === 'CHECK_PREVIEWS') {
    handleCheckPreviews().then(sendResponse).catch((err) =>
      sendResponse({ previews: {}, error: err.message })
    );
    return true;
  }

  // ---- Data from reddit-content.js (chat tab scraping) ----

  if (message.type === 'STORE_CHAT_USERNAMES') {
    const usernames = message.usernames || [];
    if (usernames.length > 0) {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const existing = new Set(result[STORAGE_KEY] || []);
        for (const u of usernames) existing.add(u);
        chrome.storage.local.set({ [STORAGE_KEY]: Array.from(existing) });
      });
      // Data arrived — notify anyone waiting
      notifyScanResolvers();
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'STORE_YOU_SENT_TO') {
    // Cumulative merge — add, never remove
    const newUsernames = message.usernames || [];
    chrome.storage.local.get(YOU_SENT_TO_KEY, (result) => {
      const existing = new Set(result[YOU_SENT_TO_KEY] || []);
      for (const u of newUsernames) existing.add(u);
      chrome.storage.local.set({ [YOU_SENT_TO_KEY]: Array.from(existing) });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'STORE_THEY_REPLIED') {
    // Cumulative merge — same as youSentTo (virtual scroll only shows ~16 at a time)
    const newUsernames = message.usernames || [];
    chrome.storage.local.get(THEY_REPLIED_KEY, (result) => {
      const existing = new Set(result[THEY_REPLIED_KEY] || []);
      for (const u of newUsernames) existing.add(u);
      chrome.storage.local.set({ [THEY_REPLIED_KEY]: Array.from(existing) });
      sendResponse({ ok: true });
    });
    return true;
  }

  // Legacy handler — keep for backwards compat during transition
  if (message.type === 'STORE_CHAT_REPLIES') {
    const newReplies = message.replies || [];
    chrome.storage.local.set({ [THEY_REPLIED_KEY]: newReplies });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'STORE_CHAT_PREVIEWS') {
    const previews = message.previews || {};
    chrome.storage.local.set({ [PREVIEWS_KEY]: previews });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'CHAT_SCAN_RESULT') {
    const { usernames = [], youSentTo = [], theyReplied = [], previews = {} } = message;
    console.log(`[SR BG] Chat scan complete: ${usernames.length} usernames, ${youSentTo.length} youSentTo, ${theyReplied.length} theyReplied`);
    if (usernames.length > 0) {
      // Usernames — cumulative
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const existing = new Set(result[STORAGE_KEY] || []);
        for (const u of usernames) existing.add(u);
        chrome.storage.local.set({ [STORAGE_KEY]: Array.from(existing) });
      });
      // youSentTo — cumulative merge
      if (youSentTo.length > 0) {
        chrome.storage.local.get(YOU_SENT_TO_KEY, (result) => {
          const existing = new Set(result[YOU_SENT_TO_KEY] || []);
          for (const u of youSentTo) existing.add(u);
          chrome.storage.local.set({ [YOU_SENT_TO_KEY]: Array.from(existing) });
        });
      }
      // theyReplied — cumulative merge (virtual scroll only shows ~16 at a time)
      if (theyReplied.length > 0) {
        chrome.storage.local.get(THEY_REPLIED_KEY, (result) => {
          const existing = new Set(result[THEY_REPLIED_KEY] || []);
          for (const u of theyReplied) existing.add(u);
          chrome.storage.local.set({ [THEY_REPLIED_KEY]: Array.from(existing) });
        });
      }
      // Previews
      if (Object.keys(previews).length > 0) {
        chrome.storage.local.set({ [PREVIEWS_KEY]: previews });
      }
    }
    // Notify anyone waiting for scan data
    notifyScanResolvers();
    sendResponse({ ok: true });
    return false;
  }
});

// ---- Track chat tab closure ----
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === chatTabId) {
    chatTabId = null;
  }
});

// ---- Cookie / Session Check ----

async function hasRedditSession() {
  const cookieNames = ['token_v2', 'reddit_session', 'session_tracker'];
  for (const name of cookieNames) {
    const cookie = await new Promise((resolve) => {
      chrome.cookies.get({ url: 'https://www.reddit.com', name }, (c) => resolve(c));
    });
    if (cookie) return true;
  }
  return false;
}

// ---- Storage Helpers ----

async function getStoredUsernames() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

async function getStoredYouSentTo() {
  return new Promise((resolve) => {
    chrome.storage.local.get(YOU_SENT_TO_KEY, (result) => {
      resolve(result[YOU_SENT_TO_KEY] || []);
    });
  });
}

async function getStoredTheyReplied() {
  return new Promise((resolve) => {
    chrome.storage.local.get(THEY_REPLIED_KEY, (result) => {
      resolve(result[THEY_REPLIED_KEY] || []);
    });
  });
}

async function getStoredPreviews() {
  return new Promise((resolve) => {
    chrome.storage.local.get(PREVIEWS_KEY, (result) => {
      resolve(result[PREVIEWS_KEY] || {});
    });
  });
}

// ---- Response Handlers ----

async function handleCheckStatus() {
  const hasSession = await hasRedditSession();
  if (!hasSession) {
    return { installed: true, redditLoggedIn: false, username: null, capturedCount: 0, youSentToCount: 0, theyRepliedCount: 0 };
  }

  // Auto-open chat tab to start scanning in the background
  ensureChatTab().catch(() => {});

  const stored = await getStoredUsernames();
  const youSentTo = await getStoredYouSentTo();
  const theyReplied = await getStoredTheyReplied();

  return {
    installed: true,
    redditLoggedIn: true,
    username: null,
    capturedCount: stored.length,
    youSentToCount: youSentTo.length,
    theyRepliedCount: theyReplied.length,
  };
}

async function handleCheckSentMessages() {
  const stored = await getStoredUsernames();
  return { usernames: stored };
}

async function handleCheckPreviews() {
  const previews = await getStoredPreviews();
  return { previews };
}
