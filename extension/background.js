// SuperReddit DM Bridge — Background Service Worker
// Stores chat usernames + reply status passively captured by reddit-content.js
// and serves them to the SuperReddit pipeline.

const STORAGE_KEY = 'sr_chat_usernames';
const REPLIES_KEY = 'sr_chat_replies';

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
    // Replace entirely — reflects current state of conversations
    chrome.storage.local.set({ [REPLIES_KEY]: replies });
    sendResponse({ ok: true });
    return false;
  }
});

// Check for Reddit session cookies
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
  return { usernames: stored, source: 'chat_scrape' };
}

async function handleCheckReplies() {
  const replies = await getStoredReplies();
  return { replies, source: 'chat_scrape' };
}
