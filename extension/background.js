// SuperReddit DM Bridge — Background Service Worker
// Automatically opens reddit.com/chat in a background tab to scrape chat data.
// The user never needs to manually open the chat tab.

const STORAGE_KEY = 'sr_chat_usernames';
const YOU_SENT_TO_KEY = 'sr_you_sent_to';
const THEY_REPLIED_KEY = 'sr_they_replied';
const PREVIEWS_KEY = 'sr_chat_previews';
const CONVERSATIONS_KEY = 'sr_conversations';
const SCAN_READY_KEY = 'sr_scan_ready';

const SCAN_ALARM = 'sr_periodic_scan';
const MSG_FETCH_ALARM = 'sr_message_fetch';
const SCAN_INTERVAL_MINUTES = 5;
const MSG_FETCH_INTERVAL_MINUTES = 3;
let lastTabOpenTime = 0;
let lastSendDmTime = 0;
let pendingSendDm = null; // { resolve, tabId, timer }
let composeTabId = null;

// SendBird credential cache (in-memory, 30 min TTL)
let sendBirdCreds = null;
let sendBirdCredsExpiry = 0;
let sendBirdRestDisabled = false;

// Conversation fetch cache (5 min TTL per user)
const conversationFetchCache = {};
const CONVERSATION_CACHE_TTL = 5 * 60 * 1000;

// ---- On install/update: start periodic scanning ----
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Fresh install — clear any stale data
    chrome.storage.local.remove(
      [STORAGE_KEY, YOU_SENT_TO_KEY, THEY_REPLIED_KEY, PREVIEWS_KEY, SCAN_READY_KEY],
      () => console.log('[SR BG] Fresh install — cleared data')
    );
  }

  // After install/update, re-inject content scripts into existing tabs
  // (old content scripts are orphaned and can't communicate with the new background)
  setTimeout(async () => {
    // Reload reddit chat tabs
    const redditTabs = await chrome.tabs.query({ url: '*://*.reddit.com/chat*' });
    for (const tab of redditTabs) {
      console.log('[SR BG] Reloading chat tab ' + tab.id + ' for fresh content script');
      chrome.tabs.reload(tab.id);
    }
    if (redditTabs.length === 0) {
      ensureChatTab().catch(() => {});
    }

    // Re-inject content.js into app tabs (localhost + vercel) so bridge reconnects
    const appTabs = await chrome.tabs.query({ url: ['http://localhost/*', 'https://*.vercel.app/*'] });
    for (const tab of appTabs) {
      console.log('[SR BG] Re-injecting content.js into app tab ' + tab.id);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      }).catch(() => {});
    }
  }, 1000);

  // Start periodic scan — first one after 3 min (gives initial scan time to complete)
  chrome.alarms.create(SCAN_ALARM, { delayInMinutes: 3, periodInMinutes: SCAN_INTERVAL_MINUTES });
  // Start background message fetching — first one after 30s, then every 3 min
  chrome.alarms.create(MSG_FETCH_ALARM, { delayInMinutes: 0.5, periodInMinutes: MSG_FETCH_INTERVAL_MINUTES });
});

// ---- On browser startup: ensure scanning is active ----
chrome.runtime.onStartup.addListener(() => {
  console.log('[SR BG] Browser started — scheduling chat scan');
  chrome.alarms.create(SCAN_ALARM, { delayInMinutes: 1, periodInMinutes: SCAN_INTERVAL_MINUTES });
  chrome.alarms.create(MSG_FETCH_ALARM, { delayInMinutes: 0.5, periodInMinutes: MSG_FETCH_INTERVAL_MINUTES });
  // Open chat tab to start scanning
  setTimeout(() => ensureChatTab().catch(() => {}), 5000);
  // Fetch messages from Reddit API immediately
  setTimeout(() => fetchRedditMessages(), 3000);
});

// ---- Periodic alarm: refresh chat data in background ----
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    console.log('[SR BG] Periodic scan — ensuring chat tab is open');
    refreshChatTab();
  }
  if (alarm.name === MSG_FETCH_ALARM) {
    fetchRedditMessages();
  }
});

// Refresh the chat tab to trigger a fresh scan by the content script
async function refreshChatTab() {
  try {
    const hasSession = await hasRedditSession();
    if (!hasSession) return;

    // Don't reload if we just opened/refreshed the tab recently (< 2 min ago)
    const now = Date.now();
    if (now - lastTabOpenTime < 120_000) {
      console.log('[SR BG] Tab opened recently, skipping refresh');
      return;
    }

    const tabId = await ensureChatTab();
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && !tab.active) {
        lastTabOpenTime = now;
        chrome.tabs.reload(tabId);
        console.log('[SR BG] Refreshed chat tab for periodic scan');
      }
    } catch { /* tab gone */ }
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
  lastTabOpenTime = Date.now();
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
    (async () => {
      try { await ensureChatTab(); } catch {}
      let usernames = await getStoredYouSentTo();
      // If storage empty, pull from chat tab directly
      if (usernames.length === 0 && chatTabId !== null) {
        const pulled = await pullDataFromChatTab();
        if (pulled && pulled.youSentTo && pulled.youSentTo.length > 0) {
          usernames = pulled.youSentTo;
        }
      }
      sendResponse({ usernames });
    })();
    return true;
  }

  if (message.type === 'CHECK_THEY_REPLIED') {
    (async () => {
      try { await ensureChatTab(); } catch {}
      let usernames = await getStoredTheyReplied();
      // If storage empty, pull from chat tab directly
      if (usernames.length === 0 && chatTabId !== null) {
        const pulled = await pullDataFromChatTab();
        if (pulled && pulled.theyReplied && pulled.theyReplied.length > 0) {
          usernames = pulled.theyReplied;
        }
      }
      sendResponse({ usernames });
    })();
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

  // ---- SEND_DM: Auto-send a DM via compose page ----

  if (message.type === 'SEND_DM') {
    (async () => {
      try {
        const { username, subject, body } = message.data || {};
        if (!username || !subject || !body) {
          sendResponse({ success: false, error: 'Missing username, subject, or body' });
          return;
        }

        // Single-send lock
        if (pendingSendDm) {
          sendResponse({ success: false, error: 'Another send is in progress', rateLimited: true, retryAfterMs: 5000 });
          return;
        }

        // 8s cooldown between sends
        const now = Date.now();
        const cooldownMs = 8000;
        const elapsed = now - lastSendDmTime;
        if (elapsed < cooldownMs) {
          const retryAfterMs = cooldownMs - elapsed;
          sendResponse({ success: false, error: 'Rate limited — wait ' + Math.ceil(retryAfterMs / 1000) + 's', rateLimited: true, retryAfterMs });
          return;
        }

        // Check Reddit session
        const hasSession = await hasRedditSession();
        if (!hasSession) {
          sendResponse({ success: false, error: 'Not logged into Reddit' });
          return;
        }

        // Build compose URL
        const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(username)}&subject=${encodeURIComponent(subject)}&message=${encodeURIComponent(body)}`;
        console.log('[SR BG] SEND_DM: opening compose tab for u/' + username);

        // Open compose page in background tab
        const tab = await chrome.tabs.create({ url: composeUrl, active: false });
        composeTabId = tab.id;

        // Set up promise to wait for COMPOSE_RESULT
        const result = await new Promise((resolve) => {
          const timer = setTimeout(() => {
            console.log('[SR BG] SEND_DM: 30s timeout for u/' + username);
            if (pendingSendDm && pendingSendDm.tabId === tab.id) {
              pendingSendDm = null;
            }
            // Close the compose tab
            try { chrome.tabs.remove(tab.id); } catch {}
            composeTabId = null;
            resolve({ success: false, error: 'Send timed out after 30s — the compose page may not have loaded' });
          }, 30000);

          pendingSendDm = { resolve, tabId: tab.id, timer };
        });

        lastSendDmTime = Date.now();
        sendResponse(result);
      } catch (err) {
        console.log('[SR BG] SEND_DM error:', err.message);
        pendingSendDm = null;
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // ---- COMPOSE_RESULT: Result from reddit-content.js on compose page ----

  if (message.type === 'COMPOSE_RESULT') {
    const { success, error, username } = message;
    console.log('[SR BG] COMPOSE_RESULT:', { success, error, username });

    if (pendingSendDm) {
      clearTimeout(pendingSendDm.timer);
      const tabId = pendingSendDm.tabId;
      const resolve = pendingSendDm.resolve;
      pendingSendDm = null;

      // Close compose tab
      try { chrome.tabs.remove(tabId); } catch {}
      composeTabId = null;

      // On success, add username to youSentTo storage
      if (success && username) {
        chrome.storage.local.get(YOU_SENT_TO_KEY, (result) => {
          const existing = new Set(result[YOU_SENT_TO_KEY] || []);
          existing.add(username.toLowerCase());
          chrome.storage.local.set({ [YOU_SENT_TO_KEY]: Array.from(existing) });
          console.log('[SR BG] Added ' + username + ' to youSentTo');
        });
      }

      resolve({ success, error });
    } else {
      // No pending send — just close the tab if it's a compose tab
      if (sender.tab && sender.tab.id) {
        try { chrome.tabs.remove(sender.tab.id); } catch {}
      }
    }
    sendResponse({ ok: true });
    return false;
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
    // Content script already merges — just store the merged result
    const previews = message.previews || {};
    if (Object.keys(previews).length > 0) {
      chrome.storage.local.set({ [PREVIEWS_KEY]: previews });
    }
    sendResponse({ ok: true });
    return false;
  }

  // ---- Full conversation data (from chat-interceptor + content script parsing) ----

  if (message.type === 'STORE_CONVERSATION_MESSAGES') {
    const { username, messages, source } = message;
    if (!username || !messages || messages.length === 0) {
      sendResponse({ ok: false });
      return false;
    }
    chrome.storage.local.get(CONVERSATIONS_KEY, (result) => {
      const convos = result[CONVERSATIONS_KEY] || {};
      const existing = convos[username] || { messages: [], lastUpdated: 0 };
      // Merge: add new messages by ID, avoiding duplicates
      const existingIds = new Set(existing.messages.map((m) => m.id).filter(Boolean));
      let added = 0;
      for (const msg of messages) {
        if (msg.id && existingIds.has(msg.id)) continue;
        existing.messages.push(msg);
        added++;
      }
      // Sort by timestamp
      existing.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      // Cap at 200 messages per conversation
      if (existing.messages.length > 200) {
        existing.messages = existing.messages.slice(-200);
      }
      existing.lastUpdated = Date.now();
      existing.source = source || 'unknown';
      convos[username] = existing;
      chrome.storage.local.set({ [CONVERSATIONS_KEY]: convos });
      if (added > 0) {
        console.log('[SR BG] Stored ' + added + ' new messages for u/' + username + ' (total: ' + existing.messages.length + ')');
      }
      sendResponse({ ok: true, added });
    });
    return true;
  }

  if (message.type === 'FETCH_ALL_CONVERSATIONS') {
    fetchRedditMessages().then(sendResponse).catch(() => sendResponse({ fetched: false }));
    return true;
  }

  if (message.type === 'GET_FULL_CONVERSATION') {
    const { username } = message.data || message;
    if (!username) {
      sendResponse({ messages: [], error: 'No username provided' });
      return false;
    }
    const userLower = username.toLowerCase();

    (async () => {
      try {
        // 1. Check cache — if fresh (< 5 min), return immediately
        const stored = await new Promise((resolve) => chrome.storage.local.get(CONVERSATIONS_KEY, resolve));
        const convos = stored[CONVERSATIONS_KEY] || {};
        const cached = convos[userLower] || null;
        const now = Date.now();

        if (cached && cached.messages && cached.messages.length > 0) {
          const age = now - (cached.lastUpdated || 0);
          if (age < CONVERSATION_CACHE_TTL) {
            console.log('[SR BG] GET_FULL_CONVERSATION: returning cached ' + cached.messages.length + ' msgs for u/' + username + ' (age: ' + Math.round(age / 1000) + 's)');
            sendResponse({
              messages: cached.messages,
              lastUpdated: cached.lastUpdated,
              source: cached.source,
            });
            return;
          }
        }

        // 2. Try SendBird REST API (primary approach)
        let result = await fetchConversationForUser(username);

        // 3. If SendBird failed, try navigation fallback
        if (!result) {
          result = await fetchConversationViaNavigation(username);
        }

        // 4. Return whatever we have (fresh fetch, or stale cache as last resort)
        if (result && result.messages && result.messages.length > 0) {
          sendResponse({
            messages: result.messages,
            lastUpdated: result.lastUpdated,
            source: result.source,
          });
        } else if (cached && cached.messages && cached.messages.length > 0) {
          console.log('[SR BG] GET_FULL_CONVERSATION: returning stale cache for u/' + username);
          sendResponse({
            messages: cached.messages,
            lastUpdated: cached.lastUpdated,
            source: cached.source,
          });
        } else {
          sendResponse({ messages: [], lastUpdated: null, source: null });
        }
      } catch (err) {
        console.log('[SR BG] GET_FULL_CONVERSATION error for u/' + username + ':', err.message);
        // Return stale cache on error
        const fallbackStored = await new Promise((resolve) => chrome.storage.local.get(CONVERSATIONS_KEY, resolve));
        const fallbackConvos = fallbackStored[CONVERSATIONS_KEY] || {};
        const fallback = fallbackConvos[userLower] || null;
        sendResponse({
          messages: fallback ? fallback.messages : [],
          lastUpdated: fallback ? fallback.lastUpdated : null,
          source: fallback ? fallback.source : null,
          error: err.message,
        });
      }
    })();
    return true;
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
      // Previews — merge with existing to preserve theirText
      if (Object.keys(previews).length > 0) {
        chrome.storage.local.get(PREVIEWS_KEY, (result) => {
          const existing = result[PREVIEWS_KEY] || {};
          const merged = { ...existing };
          for (const [username, newP] of Object.entries(previews)) {
            const old = merged[username];
            let theirText = newP.theirText || null;
            if (!theirText && !newP.fromYou) theirText = newP.text;
            if (!theirText && old) theirText = old.theirText || (!old.fromYou ? old.text : null);
            merged[username] = { text: newP.text, fromYou: newP.fromYou, theirText };
          }
          chrome.storage.local.set({ [PREVIEWS_KEY]: merged });
        });
      }
    }
    // Notify anyone waiting for scan data
    notifyScanResolvers();
    sendResponse({ ok: true });
    return false;
  }
});

// ---- Track tab closure ----
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === chatTabId) {
    chatTabId = null;
  }
  // If compose tab closed prematurely, resolve pending send with error
  if (tabId === composeTabId) {
    composeTabId = null;
    if (pendingSendDm && pendingSendDm.tabId === tabId) {
      clearTimeout(pendingSendDm.timer);
      pendingSendDm.resolve({ success: false, error: 'Compose tab was closed before send completed' });
      pendingSendDm = null;
    }
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

// ---- Pull data directly from chat tab's content script ----
// Bypasses chrome.storage issues with orphaned content scripts.
// Background uses chrome.tabs.sendMessage() to ask the content script for data.

async function pullDataFromChatTab() {
  const tabId = chatTabId;
  if (!tabId) return null;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.includes('reddit.com/chat')) return null;
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000);
    try {
      chrome.tabs.sendMessage(tabId, { type: 'GET_SCAN_DATA' }, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError || !response) {
          console.log('[SR BG] Pull from chat tab failed:', chrome.runtime.lastError?.message || 'no response');
          resolve(null);
          return;
        }
        console.log('[SR BG] Pulled data from chat tab:', response.usernames?.length, 'usernames,', response.youSentTo?.length, 'youSentTo,', response.theyReplied?.length, 'theyReplied');
        // Store pulled data into chrome.storage (background always has valid storage access)
        const { usernames = [], youSentTo = [], theyReplied = [], previews = {} } = response;
        if (usernames.length > 0) {
          chrome.storage.local.get(STORAGE_KEY, (result) => {
            const existing = new Set(result[STORAGE_KEY] || []);
            for (const u of usernames) existing.add(u);
            chrome.storage.local.set({ [STORAGE_KEY]: Array.from(existing) });
          });
        }
        if (youSentTo.length > 0) {
          chrome.storage.local.get(YOU_SENT_TO_KEY, (result) => {
            const existing = new Set(result[YOU_SENT_TO_KEY] || []);
            for (const u of youSentTo) existing.add(u);
            chrome.storage.local.set({ [YOU_SENT_TO_KEY]: Array.from(existing) });
          });
        }
        if (theyReplied.length > 0) {
          chrome.storage.local.get(THEY_REPLIED_KEY, (result) => {
            const existing = new Set(result[THEY_REPLIED_KEY] || []);
            for (const u of theyReplied) existing.add(u);
            chrome.storage.local.set({ [THEY_REPLIED_KEY]: Array.from(existing) });
          });
        }
        if (Object.keys(previews).length > 0) {
          // Merge preserving theirText
          chrome.storage.local.get(PREVIEWS_KEY, (result) => {
            const existing = result[PREVIEWS_KEY] || {};
            const merged = { ...existing };
            for (const [username, newP] of Object.entries(previews)) {
              const old = merged[username];
              let theirText = newP.theirText || null;
              if (!theirText && !newP.fromYou) theirText = newP.text;
              if (!theirText && old) theirText = old.theirText || (!old.fromYou ? old.text : null);
              merged[username] = { text: newP.text, fromYou: newP.fromYou, theirText };
            }
            chrome.storage.local.set({ [PREVIEWS_KEY]: merged });
          });
        }
        resolve(response);
      });
    } catch (err) {
      clearTimeout(timer);
      console.log('[SR BG] Pull error:', err.message);
      resolve(null);
    }
  });
}

// ---- Background Reddit Message Fetching ----
// Uses chrome.scripting.executeScript to fetch messages FROM a Reddit tab,
// so the browser automatically includes session cookies. Runs on a periodic
// alarm — no user action needed.

async function getRedditTabId() {
  // Prefer the chat tab we already manage
  if (chatTabId) {
    try {
      const tab = await chrome.tabs.get(chatTabId);
      if (tab && tab.url && tab.url.includes('reddit.com')) return chatTabId;
    } catch { /* tab gone */ }
  }
  // Fall back to any open reddit tab
  const tabs = await chrome.tabs.query({ url: '*://*.reddit.com/*' });
  if (tabs.length > 0) return tabs[0].id;
  return null;
}

async function fetchRedditMessages() {
  let tabId = await getRedditTabId();

  if (!tabId) {
    // No Reddit tab — open one in the background
    try {
      const tab = await chrome.tabs.create({ url: 'https://www.reddit.com/message/inbox', active: false });
      tabId = tab.id;
      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 4000));
    } catch (err) {
      console.log('[SR BG] Could not create Reddit tab:', err.message);
      return { fetched: false, reason: 'no_tab' };
    }
  }

  try {
    // Execute fetch inside the Reddit page context — cookies included automatically
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async function () {
        try {
          var responses = await Promise.all([
            fetch('/message/inbox.json?limit=100&raw_json=1'),
            fetch('/message/sent.json?limit=100&raw_json=1'),
          ]);
          if (!responses[0].ok || !responses[1].ok) {
            return { error: 'HTTP ' + responses[0].status + '/' + responses[1].status };
          }
          var inbox = await responses[0].json();
          var sent = await responses[1].json();
          return { inbox: inbox, sent: sent };
        } catch (e) {
          return { error: e.message };
        }
      },
    });

    if (!results || !results[0] || !results[0].result) {
      console.log('[SR BG] executeScript returned no result');
      return { fetched: false, reason: 'no_result' };
    }

    const data = results[0].result;
    if (data.error) {
      console.log('[SR BG] Message fetch page error:', data.error);
      return { fetched: false, reason: data.error };
    }

    const { inbox, sent } = data;

    // Determine who "me" is from sent messages
    const sentChildren = (sent && sent.data && sent.data.children) || [];
    let myUsername = null;
    for (const child of sentChildren) {
      if (child.data && child.data.author) {
        myUsername = child.data.author.toLowerCase();
        break;
      }
    }

    // Parse messages
    const inboxChildren = (inbox && inbox.data && inbox.data.children) || [];
    const allRaw = [];

    for (const child of inboxChildren) {
      const d = child && child.data;
      if (!d || !d.body) continue;
      allRaw.push({
        id: d.name || ('t4_' + d.id),
        text: d.body,
        author: (d.author || '').toLowerCase(),
        dest: (d.dest || '').toLowerCase(),
        isFromYou: myUsername ? (d.author || '').toLowerCase() === myUsername : false,
        timestamp: (d.created_utc || 0) * 1000,
      });
    }
    for (const child of sentChildren) {
      const d = child && child.data;
      if (!d || !d.body) continue;
      allRaw.push({
        id: d.name || ('t4_' + d.id),
        text: d.body,
        author: (d.author || '').toLowerCase(),
        dest: (d.dest || '').toLowerCase(),
        isFromYou: true,
        timestamp: (d.created_utc || 0) * 1000,
      });
    }

    if (allRaw.length === 0) {
      console.log('[SR BG] No messages found in inbox/sent (inbox=' + inboxChildren.length + ' sent=' + sentChildren.length + ')');
      return { fetched: true, count: 0, conversations: 0 };
    }

    // If we couldn't determine "me" from sent, try from inbox (dest is me)
    if (!myUsername && inboxChildren.length > 0) {
      const firstInbox = inboxChildren[0].data;
      if (firstInbox) myUsername = (firstInbox.dest || '').toLowerCase();
    }

    // Group by conversation partner
    const grouped = {};
    for (const msg of allRaw) {
      const partner = msg.isFromYou ? msg.dest : msg.author;
      if (!partner || partner === myUsername) continue;
      if (!grouped[partner]) grouped[partner] = [];
      grouped[partner].push({
        id: msg.id,
        text: msg.text,
        author: msg.isFromYou ? (myUsername || 'you') : partner,
        isFromYou: msg.isFromYou,
        timestamp: msg.timestamp,
      });
    }

    // Merge into conversation storage
    const stored = await new Promise((resolve) => chrome.storage.local.get(CONVERSATIONS_KEY, resolve));
    const convos = stored[CONVERSATIONS_KEY] || {};
    let totalAdded = 0;

    for (const [partner, messages] of Object.entries(grouped)) {
      const existing = convos[partner] || { messages: [], lastUpdated: 0 };
      const existingIds = new Set(existing.messages.map((m) => m.id).filter(Boolean));

      let added = 0;
      for (const msg of messages) {
        if (msg.id && existingIds.has(msg.id)) continue;
        existing.messages.push(msg);
        added++;
      }

      existing.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      if (existing.messages.length > 200) {
        existing.messages = existing.messages.slice(-200);
      }
      existing.lastUpdated = Date.now();
      if (!existing.source || existing.source === 'background_fetch') {
        existing.source = 'background_fetch';
      }
      convos[partner] = existing;
      totalAdded += added;
    }

    await new Promise((resolve) => chrome.storage.local.set({ [CONVERSATIONS_KEY]: convos }, resolve));
    console.log('[SR BG] Message fetch: ' + totalAdded + ' new msgs across ' + Object.keys(grouped).length + ' conversations');
    return { fetched: true, count: totalAdded, conversations: Object.keys(grouped).length };
  } catch (err) {
    console.log('[SR BG] Message fetch error:', err.message);
    return { fetched: false, reason: err.message };
  }
}

// ---- SendBird Conversation Fetching ----
// Uses executeScript in MAIN world on a Reddit tab to call SendBird APIs
// with the user's session. All fetches happen inside the page context so
// CORS is satisfied (Reddit's own frontend makes these same calls).

async function fetchConversationForUser(username) {
  if (sendBirdRestDisabled) {
    console.log('[SR BG] SendBird REST disabled — skipping for u/' + username);
    return null;
  }

  const tabId = await getRedditTabId();
  if (!tabId) {
    console.log('[SR BG] No Reddit tab for SendBird fetch');
    return null;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async function (targetUsername) {
        try {
          // Step 1: Get SendBird credentials
          var credsResp = await fetch('https://s.reddit.com/api/v1/sendbird/me', {
            credentials: 'include',
          });
          if (!credsResp.ok) {
            return { error: 'sendbird_creds_' + credsResp.status, status: credsResp.status };
          }
          var creds = await credsResp.json();
          var token = creds.sb_access_token;
          var userId = creds.sb_user_id;
          var appId = creds.sb_app_id;

          if (!token || !userId || !appId) {
            return { error: 'missing_creds', creds: Object.keys(creds) };
          }

          var baseUrl = 'https://api-' + appId + '.sendbird.com/v3';
          var headers = {
            'Api-Token': token,
            'Session-Key': token,
            'Content-Type': 'application/json',
          };

          // Step 2: Find the channel with this user
          var channelsResp = await fetch(
            baseUrl + '/users/' + encodeURIComponent(userId) + '/my_group_channels?limit=100&show_member=true&order=latest_last_message',
            { headers: headers }
          );
          if (!channelsResp.ok) {
            return { error: 'channels_' + channelsResp.status, status: channelsResp.status };
          }
          var channelsData = await channelsResp.json();
          var channels = channelsData.channels || [];

          // Find the 1-on-1 channel that includes targetUsername
          var targetLower = targetUsername.toLowerCase();
          var matchedChannel = null;

          for (var i = 0; i < channels.length; i++) {
            var ch = channels[i];
            var members = ch.members || [];
            // 1-on-1 DM channels typically have exactly 2 members
            if (members.length !== 2) continue;
            for (var j = 0; j < members.length; j++) {
              var member = members[j];
              var nickname = (member.nickname || '').toLowerCase();
              var memberUserId = (member.user_id || '').toLowerCase();
              // Match by nickname or by user_id (Reddit uses t2_xxx format)
              if (nickname === targetLower || memberUserId === targetLower) {
                matchedChannel = ch;
                break;
              }
            }
            if (matchedChannel) break;
          }

          if (!matchedChannel) {
            return { error: 'no_channel', channelCount: channels.length, target: targetUsername };
          }

          // Step 3: Fetch messages from the channel
          var channelUrl = encodeURIComponent(matchedChannel.channel_url);
          var msgsResp = await fetch(
            baseUrl + '/group_channels/' + channelUrl + '/messages?prev_limit=100&include=true&reverse=false',
            { headers: headers }
          );
          if (!msgsResp.ok) {
            return { error: 'messages_' + msgsResp.status, status: msgsResp.status };
          }
          var msgsData = await msgsResp.json();
          var rawMessages = msgsData.messages || [];

          // Build a member lookup: user_id → nickname
          var memberMap = {};
          var channelMembers = matchedChannel.members || [];
          for (var k = 0; k < channelMembers.length; k++) {
            var m = channelMembers[k];
            memberMap[m.user_id] = (m.nickname || m.user_id || '').toLowerCase();
          }

          // Format messages
          var formatted = [];
          for (var n = 0; n < rawMessages.length; n++) {
            var raw = rawMessages[n];
            // Skip non-user messages (admin, system)
            if (raw.type && raw.type !== 'MESG') continue;
            var text = raw.message || '';
            if (!text) continue;
            var senderId = raw.user ? (raw.user.user_id || '') : '';
            var senderName = raw.user ? (raw.user.nickname || senderId || '').toLowerCase() : '';
            formatted.push({
              id: 'sb_' + (raw.message_id || raw.msg_id || n),
              text: text,
              author: memberMap[senderId] || senderName,
              isFromYou: senderId === userId,
              timestamp: raw.created_at || 0,
            });
          }

          return {
            messages: formatted,
            channelUrl: matchedChannel.channel_url,
            myUserId: userId,
          };
        } catch (e) {
          return { error: e.message };
        }
      },
      args: [username],
    });

    if (!results || !results[0] || !results[0].result) {
      console.log('[SR BG] SendBird executeScript returned no result');
      return null;
    }

    const data = results[0].result;

    if (data.error) {
      console.log('[SR BG] SendBird fetch error for u/' + username + ':', data.error);
      // If auth failed (401/403), disable SendBird REST for this session
      if (data.status === 401 || data.status === 403) {
        console.log('[SR BG] SendBird REST auth failed — disabling for this session');
        sendBirdRestDisabled = true;
      }
      return null;
    }

    if (!data.messages || data.messages.length === 0) {
      console.log('[SR BG] SendBird: no messages found for u/' + username);
      return null;
    }

    console.log('[SR BG] SendBird: fetched ' + data.messages.length + ' messages for u/' + username);

    // Store in conversation storage
    const stored = await new Promise((resolve) => chrome.storage.local.get(CONVERSATIONS_KEY, resolve));
    const convos = stored[CONVERSATIONS_KEY] || {};
    const existing = convos[username.toLowerCase()] || { messages: [], lastUpdated: 0 };
    const existingIds = new Set(existing.messages.map((m) => m.id).filter(Boolean));

    let added = 0;
    for (const msg of data.messages) {
      if (msg.id && existingIds.has(msg.id)) continue;
      existing.messages.push(msg);
      added++;
    }
    existing.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (existing.messages.length > 200) {
      existing.messages = existing.messages.slice(-200);
    }
    existing.lastUpdated = Date.now();
    existing.source = 'sendbird';
    convos[username.toLowerCase()] = existing;
    await new Promise((resolve) => chrome.storage.local.set({ [CONVERSATIONS_KEY]: convos }, resolve));

    console.log('[SR BG] SendBird: stored ' + added + ' new messages for u/' + username + ' (total: ' + existing.messages.length + ')');
    return existing;
  } catch (err) {
    console.log('[SR BG] SendBird fetch exception for u/' + username + ':', err.message);
    return null;
  }
}

// ---- Navigation-Based Fallback ----
// When SendBird REST fails, navigate the chat tab to the target conversation
// and let the existing interceptor capture the API responses.

async function fetchConversationViaNavigation(username) {
  const tabId = chatTabId || await ensureChatTab().catch(() => null);
  if (!tabId) {
    console.log('[SR BG] No chat tab for navigation fallback');
    return null;
  }

  try {
    // Ask the content script to click the conversation in the sidebar
    const response = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 8000);
      chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE_TO_CHAT', username }, (resp) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          console.log('[SR BG] NAVIGATE_TO_CHAT failed:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(resp);
      });
    });

    if (!response || !response.triggered) {
      console.log('[SR BG] Navigation fallback: could not trigger conversation for u/' + username);
      return null;
    }

    console.log('[SR BG] Navigation fallback: triggered conversation for u/' + username + ', waiting for interceptor...');

    // Wait for the interceptor to capture API responses
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Read from conversation storage (interceptor should have stored messages)
    const stored = await new Promise((resolve) => chrome.storage.local.get(CONVERSATIONS_KEY, resolve));
    const convos = stored[CONVERSATIONS_KEY] || {};
    const convo = convos[username.toLowerCase()] || null;

    if (convo && convo.messages && convo.messages.length > 0) {
      console.log('[SR BG] Navigation fallback: found ' + convo.messages.length + ' messages for u/' + username);
      return convo;
    }

    console.log('[SR BG] Navigation fallback: no messages captured for u/' + username);
    return null;
  } catch (err) {
    console.log('[SR BG] Navigation fallback error for u/' + username + ':', err.message);
    return null;
  }
}

// ---- Response Handlers ----

async function handleCheckStatus() {
  const hasSession = await hasRedditSession();
  if (!hasSession) {
    return { installed: true, redditLoggedIn: false, username: null, capturedCount: 0, youSentToCount: 0, theyRepliedCount: 0 };
  }

  // Auto-open chat tab to start scanning in the background
  try { await ensureChatTab(); } catch {}

  let stored = await getStoredUsernames();
  let youSentTo = await getStoredYouSentTo();
  let theyReplied = await getStoredTheyReplied();

  // If storage is empty but chat tab exists, pull data directly from content script
  if (stored.length === 0 && youSentTo.length === 0 && chatTabId !== null) {
    console.log('[SR BG] Storage empty — pulling data from chat tab');
    const pulled = await pullDataFromChatTab();
    if (pulled && pulled.usernames && pulled.usernames.length > 0) {
      stored = pulled.usernames;
      youSentTo = pulled.youSentTo || [];
      theyReplied = pulled.theyReplied || [];
    }
  }

  return {
    installed: true,
    redditLoggedIn: true,
    username: null,
    capturedCount: stored.length,
    youSentToCount: youSentTo.length,
    theyRepliedCount: theyReplied.length,
    youSentTo,
    theyReplied,
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
