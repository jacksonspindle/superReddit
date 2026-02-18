// SuperReddit Offscreen Document
// Fetches Reddit's /message/ endpoints using the user's session token.
// Captures old-style PMs and comment replies (NOT Chat DMs — those come from the hidden popup approach).
// Data is sent to the background script for storage.

const POLL_INTERVAL = 60_000; // 1 minute

// Keep service worker alive
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_HEARTBEAT' }).catch(() => {});
}, 20_000);

// ---- Get Reddit access token from background ----
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_REDDIT_TOKEN' }, (response) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(response?.token || null);
    });
  });
}

// ---- Main sync function ----
async function syncRedditMessages() {
  console.log('[SR Offscreen] Sync cycle...');
  const token = await getAccessToken();
  if (!token) {
    console.log('[SR Offscreen] No token');
    return;
  }

  const usernames = new Set();
  const previews = {};
  const replies = new Set();
  let myUsername = null;

  // Get our own username
  try {
    const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      myUsername = me.name;
      console.log(`[SR Offscreen] Logged in as: ${myUsername}`);
    }
  } catch (e) {
    console.log(`[SR Offscreen] /me failed: ${e.message}`);
  }

  // Fetch inbox (comment replies + old PMs received)
  await fetchMessages({
    url: 'https://oauth.reddit.com/message/inbox?limit=100',
    token, label: 'Inbox', usernames, previews, replies, myUsername, isSent: false,
  });

  // Fetch sent (old-style PMs sent — Chat DMs won't appear here)
  await fetchMessages({
    url: 'https://oauth.reddit.com/message/sent?limit=100',
    token, label: 'Sent', usernames, previews, replies, myUsername, isSent: true,
  });

  const usernameArray = Array.from(usernames);
  const replyArray = Array.from(replies);
  console.log(`[SR Offscreen] Result: ${usernameArray.length} usernames, ${replyArray.length} replies, ${Object.keys(previews).length} previews`);

  if (usernameArray.length > 0) {
    storeResults(usernameArray, replyArray, previews);
  }
}

// ---- Fetch + parse a Reddit /message/ endpoint ----
async function fetchMessages({ url, token, label, usernames, previews, replies, myUsername, isSent }) {
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.log(`[SR Offscreen] ${label}: ${res.status}`);
      return;
    }

    const data = await res.json();
    const messages = data?.data?.children || [];
    console.log(`[SR Offscreen] ${label}: ${messages.length} items`);

    for (const msg of messages) {
      const d = msg.data;
      if (!d) continue;

      if (isSent) {
        if (d.dest && looksLikeUsername(d.dest)) {
          const dest = d.dest.toLowerCase();
          usernames.add(dest);
          if (!previews[dest]) {
            previews[dest] = { text: (d.body || d.subject || '').substring(0, 120), fromYou: true };
          }
        }
      } else {
        if (d.author && looksLikeUsername(d.author) && d.author !== myUsername) {
          const author = d.author.toLowerCase();
          usernames.add(author);
          replies.add(author);
          if (!previews[author]) {
            previews[author] = { text: (d.body || d.subject || '').substring(0, 120), fromYou: false };
          }
        }
      }
    }
  } catch (e) {
    console.log(`[SR Offscreen] ${label} failed: ${e.message}`);
  }
}

// ---- Storage (via background script) ----
function storeResults(newUsernames, newReplies, newPreviews) {
  chrome.runtime.sendMessage(
    { type: 'STORE_CHAT_USERNAMES', usernames: newUsernames },
    () => { if (chrome.runtime.lastError) { /* ignore */ } }
  );
  if (newReplies.length > 0) {
    chrome.runtime.sendMessage(
      { type: 'STORE_CHAT_REPLIES', replies: newReplies },
      () => { if (chrome.runtime.lastError) { /* ignore */ } }
    );
  }
  if (Object.keys(newPreviews).length > 0) {
    chrome.runtime.sendMessage(
      { type: 'STORE_CHAT_PREVIEWS', previews: newPreviews },
      () => { if (chrome.runtime.lastError) { /* ignore */ } }
    );
  }
}

// ---- Username validation ----
function looksLikeUsername(str) {
  if (!str || str.length < 3 || str.length > 20) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(str)) return false;
  if (COMMON_WORDS.has(str.toLowerCase())) return false;
  if (/[0-9_-]/.test(str) || str.length >= 6) return true;
  return false;
}

const COMMON_WORDS = new Set([
  'chats', 'chat', 'threads', 'thread', 'message', 'messages', 'you',
  'requests', 'request', 'today', 'yesterday', 'online', 'offline',
  'typing', 'sent', 'delivered', 'read', 'unread', 'new', 'search',
  'settings', 'preferences', 'notifications', 'invite', 'create',
  'group', 'direct', 'room', 'rooms', 'channel', 'channels',
  'reddit', 'karma', 'redditor', 'mod', 'admin', 'delete', 'edit',
  'reply', 'share', 'save', 'hide', 'report', 'block', 'mute',
  'feb', 'jan', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep',
  'oct', 'nov', 'dec', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday', 'the', 'and', 'for', 'that', 'this',
  'fill', 'stroke', 'width', 'height', 'path', 'circle', 'rect',
  'line', 'text', 'none', 'auto', 'inherit', 'true', 'false',
  'now', 'great', 'thx', 'thanks', 'week', 'piece', 'good', 'bar',
  'yes', 'yeah', 'nah', 'hey', 'lol', 'wow', 'cool', 'nice',
  'more', 'less', 'all', 'any', 'some', 'most', 'other', 'each',
  'just', 'also', 'very', 'much', 'here', 'there', 'where', 'when',
  'what', 'how', 'who', 'which', 'been', 'have', 'has', 'had',
  'will', 'would', 'could', 'should', 'can', 'may', 'might',
  'about', 'after', 'before', 'between', 'through', 'under', 'over',
  'from', 'into', 'with', 'than', 'then', 'them', 'they', 'their',
  'your', 'our', 'its', 'his', 'her', 'not', 'but', 'are', 'was',
  'were', 'did', 'does', 'done', 'got', 'get', 'let', 'make',
  'like', 'know', 'think', 'want', 'need', 'seem', 'take', 'come',
  'look', 'give', 'find', 'tell', 'ask', 'use', 'try', 'keep',
]);

// ---- Start ----
console.log('[SR Offscreen] Starting /message/ sync');
syncRedditMessages();
setInterval(syncRedditMessages, POLL_INTERVAL);
