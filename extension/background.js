// SuperReddit DM Bridge — Background Service Worker
// 1. Stores chat data passively captured by reddit-content.js (chat page)
// 2. Polls Reddit's message endpoints in the background (no page visit needed)

const STORAGE_KEY = 'sr_chat_usernames';
const REPLIES_KEY = 'sr_chat_replies';
const PREVIEWS_KEY = 'sr_chat_previews';
const POLL_ALARM = 'sr_poll_reddit';
const POLL_INTERVAL_MINUTES = 5;

// ---- Message Handlers ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  // Manual trigger to poll now
  if (message.type === 'POLL_NOW') {
    pollRedditMessages().then(sendResponse).catch((err) =>
      sendResponse({ error: err.message })
    );
    return true;
  }
});

// ---- Background Polling ----

// Set up alarm on install/startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_INTERVAL_MINUTES });
  // Run immediately on install
  pollRedditMessages().catch((err) => console.warn('[SuperReddit] Initial poll failed:', err.message));
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    pollRedditMessages().catch((err) => console.warn('[SuperReddit] Poll failed:', err.message));
  }
});

// Fetch a Reddit JSON endpoint with the user's cookies
async function fetchRedditJson(path) {
  const cookies = await new Promise((resolve) => {
    chrome.cookies.getAll({ domain: '.reddit.com' }, (c) => resolve(c || []));
  });

  if (cookies.length === 0) return null;

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  const resp = await fetch(`https://www.reddit.com${path}`, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SuperRedditBridge/1.3',
    },
    credentials: 'omit', // we set cookies manually
  });

  if (resp.status === 429) {
    console.warn('[SuperReddit] Rate limited by Reddit, will retry next poll');
    return null;
  }

  if (!resp.ok) {
    console.warn(`[SuperReddit] Reddit returned ${resp.status} for ${path}`);
    return null;
  }

  return resp.json();
}

// Poll sent messages and inbox from Reddit's JSON endpoints
async function pollRedditMessages() {
  const hasSession = await hasRedditSession();
  if (!hasSession) {
    console.log('[SuperReddit] No Reddit session, skipping poll');
    return { sent: 0, inbox: 0 };
  }

  console.log('[SuperReddit] Polling Reddit messages...');

  let sentCount = 0;
  let inboxCount = 0;

  // --- Fetch sent messages ---
  try {
    const sentData = await fetchRedditJson('/message/sent.json?limit=100');
    if (sentData?.data?.children) {
      const sentUsernames = new Set();
      const newPreviews = {};

      for (const child of sentData.data.children) {
        const msg = child.data;
        if (msg.dest) {
          const dest = msg.dest.toLowerCase();
          sentUsernames.add(dest);

          // Capture the message body as preview (what we sent)
          if (msg.body && !newPreviews[dest]) {
            const previewText = msg.body.length > 120 ? msg.body.substring(0, 120) + '...' : msg.body;
            newPreviews[dest] = { text: previewText, fromYou: true };
          }
        }
      }

      // Merge sent usernames into storage
      if (sentUsernames.size > 0) {
        const existing = await getStoredUsernames();
        const merged = new Set([...existing, ...sentUsernames]);
        await setStorage(STORAGE_KEY, Array.from(merged));
        sentCount = sentUsernames.size;
      }

      // Merge previews (don't overwrite chat-scraped previews)
      if (Object.keys(newPreviews).length > 0) {
        const existingPreviews = await getStoredPreviews();
        const mergedPreviews = { ...newPreviews, ...existingPreviews }; // existing takes priority
        await setStorage(PREVIEWS_KEY, mergedPreviews);
      }
    }
  } catch (err) {
    console.warn('[SuperReddit] Failed to fetch sent messages:', err.message);
  }

  // --- Fetch inbox (replies to us) ---
  try {
    const inboxData = await fetchRedditJson('/message/inbox.json?limit=100');
    if (inboxData?.data?.children) {
      const repliedUsernames = new Set();
      const inboxPreviews = {};

      for (const child of inboxData.data.children) {
        const msg = child.data;
        if (msg.author) {
          const author = msg.author.toLowerCase();
          repliedUsernames.add(author);

          // Capture their reply as preview
          if (msg.body && !inboxPreviews[author]) {
            const previewText = msg.body.length > 120 ? msg.body.substring(0, 120) + '...' : msg.body;
            inboxPreviews[author] = { text: previewText, fromYou: false };
          }
        }
      }

      // Cross-reference: only mark as "replied" if we also sent to them
      const sentUsernames = await getStoredUsernames();
      const sentSet = new Set(sentUsernames.map((u) => u.toLowerCase()));

      const confirmedReplies = Array.from(repliedUsernames).filter((u) => sentSet.has(u));

      if (confirmedReplies.length > 0) {
        // Merge with existing replies (from chat scraping)
        const existingReplies = await getStoredReplies();
        const mergedReplies = [...new Set([...existingReplies, ...confirmedReplies])];
        await setStorage(REPLIES_KEY, mergedReplies);
        inboxCount = confirmedReplies.length;
      }

      // Merge inbox previews (these take priority — they're the latest message)
      if (Object.keys(inboxPreviews).length > 0) {
        const existingPreviews = await getStoredPreviews();
        const mergedPreviews = { ...existingPreviews, ...inboxPreviews }; // inbox overwrites
        await setStorage(PREVIEWS_KEY, mergedPreviews);
      }
    }
  } catch (err) {
    console.warn('[SuperReddit] Failed to fetch inbox:', err.message);
  }

  console.log(`[SuperReddit] Poll complete: ${sentCount} sent, ${inboxCount} replies`);
  return { sent: sentCount, inbox: inboxCount };
}

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

function setStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

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
