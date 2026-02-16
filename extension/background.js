// SuperReddit DM Bridge — Background Service Worker
// 1. Creates a hidden offscreen document that loads Reddit chat
// 2. reddit-content.js runs inside the chat iframe and scrapes data
// 3. Relays scraped data to the SuperReddit app via chrome.storage
// 4. Side panel available as optional bonus (actually use chat)

const STORAGE_KEY = 'sr_chat_usernames';
const REPLIES_KEY = 'sr_chat_replies';
const PREVIEWS_KEY = 'sr_chat_previews';
const KEEPALIVE_ALARM = 'sr_keepalive';

// ---- Offscreen Document Lifecycle ----

async function ensureOffscreen() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) return;

  // Create the offscreen document with Reddit chat iframe
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['IFRAME_SCRIPTING'],
      justification: 'Sync Reddit chat DM status with SuperReddit pipeline in background',
    });
    console.log('[SuperReddit] Offscreen document created — Reddit chat loading in background');
  } catch (err) {
    // "Only a single offscreen document may be created" — already exists
    if (!err.message?.includes('single offscreen')) {
      console.warn('[SuperReddit] Failed to create offscreen document:', err.message);
    }
  }
}

// Launch on install and startup
chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreen();
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 2 });
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreen();
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 2 });
});

// Also run immediately when service worker loads (covers toggle off/on, reload)
ensureOffscreen();
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 2 });

// Keepalive alarm — recreate offscreen if Chrome killed it
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    ensureOffscreen();
  }
});

// ---- Manual Script Injection for Offscreen Iframe ----
// Content scripts may not auto-inject into iframes inside offscreen documents.
// Use webNavigation to detect when reddit.com loads in any frame, then inject manually.

chrome.webNavigation.onCompleted.addListener(
  (details) => {
    // Only inject into sub_frames (iframes), not top-level tabs we already handle via manifest
    if (details.frameId === 0) return;

    console.log(`[SuperReddit] Reddit frame loaded: ${details.url} (tab ${details.tabId}, frame ${details.frameId}, documentId: ${details.documentId})`);

    // Use documentId when available (works for offscreen document iframes where tabId is -1)
    // Fall back to tabId + frameId for regular tab iframes
    const target = details.documentId
      ? { documentIds: [details.documentId] }
      : details.tabId > 0
        ? { tabId: details.tabId, frameIds: [details.frameId] }
        : null;

    if (!target) {
      console.log('[SuperReddit] No valid injection target for frame');
      return;
    }

    chrome.scripting.executeScript({
      target,
      files: ['reddit-content.js'],
    }).then(() => {
      console.log('[SuperReddit] Content script injected into Reddit iframe');
    }).catch((err) => {
      // Expected to fail for regular tabs where it's already injected via manifest
      console.log('[SuperReddit] Script injection note:', err.message);
    });
  },
  { url: [{ hostSuffix: '.reddit.com' }] }
);

// ---- Side Panel: open on extension icon click ----

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ---- Message Handlers ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Heartbeat from offscreen document — just acknowledge
  if (message.type === 'OFFSCREEN_HEARTBEAT' || message.type === 'OFFSCREEN_FRAME_LOADED' || message.type === 'OFFSCREEN_FRAME_ERROR') {
    sendResponse({ ok: true });
    return false;
  }

  // Offscreen document requests Reddit token (chrome.cookies not available in offscreen)
  if (message.type === 'GET_REDDIT_TOKEN') {
    (async () => {
      const tokenNames = ['token_v2', 'reddit_session'];
      for (const name of tokenNames) {
        const cookie = await new Promise((resolve) => {
          chrome.cookies.get({ url: 'https://www.reddit.com', name }, (c) => resolve(c));
        });
        if (cookie?.value) {
          sendResponse({ token: cookie.value });
          return;
        }
      }
      sendResponse({ token: null });
    })();
    return true;
  }

  if (message.type === 'CHECK_STATUS') {
    handleCheckStatus().then(sendResponse).catch((err) =>
      sendResponse({ installed: true, redditLoggedIn: false, error: err.message })
    );
    return true;
  }

  if (message.type === 'CHECK_SENT_MESSAGES') {
    handleCheckSentMessages().then(sendResponse).catch((err) =>
      sendResponse({ usernames: [], error: err.message })
    );
    return true;
  }

  if (message.type === 'CHECK_REPLIES') {
    handleCheckReplies().then(sendResponse).catch((err) =>
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

  // Receive scraped usernames from reddit-content.js
  if (message.type === 'STORE_CHAT_USERNAMES') {
    const usernames = message.usernames || [];
    if (usernames.length > 0) {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const existing = new Set(result[STORAGE_KEY] || []);
        for (const u of usernames) existing.add(u);
        chrome.storage.local.set({ [STORAGE_KEY]: Array.from(existing) });
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  // Receive reply status from reddit-content.js
  if (message.type === 'STORE_CHAT_REPLIES') {
    const replies = message.replies || [];
    chrome.storage.local.set({ [REPLIES_KEY]: replies });
    sendResponse({ ok: true });
    return false;
  }

  // Receive message previews from reddit-content.js
  if (message.type === 'STORE_CHAT_PREVIEWS') {
    const previews = message.previews || {};
    chrome.storage.local.set({ [PREVIEWS_KEY]: previews });
    sendResponse({ ok: true });
    return false;
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

async function getStoredReplies() {
  return new Promise((resolve) => {
    chrome.storage.local.get(REPLIES_KEY, (result) => {
      resolve(result[REPLIES_KEY] || []);
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
    return { installed: true, redditLoggedIn: false, username: null, capturedCount: 0, replyCount: 0 };
  }

  const stored = await getStoredUsernames();
  const replies = await getStoredReplies();

  return {
    installed: true,
    redditLoggedIn: true,
    username: null,
    capturedCount: stored.length,
    replyCount: replies.length,
  };
}

async function handleCheckSentMessages() {
  const stored = await getStoredUsernames();
  return { usernames: stored };
}

async function handleCheckReplies() {
  const replies = await getStoredReplies();
  return { replies };
}

async function handleCheckPreviews() {
  const previews = await getStoredPreviews();
  return { previews };
}
