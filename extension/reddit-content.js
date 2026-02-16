// SuperReddit DM Bridge — Reddit Content Script
// Passively reads chat conversation usernames from the Reddit chat page DOM.
// Only runs when the user visits reddit.com — no automated access.

(function () {
  const SCAN_INTERVAL = 3000;
  const STORAGE_KEY = 'sr_chat_usernames';

  // ---- DOM Scanning ----
  function scanChatDOM() {
    const usernames = new Set();

    // Strategy 1: Links to user profiles (most reliable)
    document.querySelectorAll('a[href*="/user/"]').forEach((link) => {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        usernames.add(match[1].toLowerCase());
      }
    });

    // Strategy 2: Elements with data-username or data-author attributes
    document.querySelectorAll('[data-username], [data-author]').forEach((el) => {
      const name = el.getAttribute('data-username') || el.getAttribute('data-author');
      if (name) usernames.add(name.toLowerCase());
    });

    // Strategy 3: Chat-specific selectors (conversation list items)
    document.querySelectorAll(
      '[class*="conversation"] [class*="name"], ' +
      '[class*="chat"] [class*="username"], ' +
      '[class*="chat"] [class*="author"], ' +
      '[data-testid*="conversation"] [data-testid*="name"]'
    ).forEach((el) => {
      const text = el.textContent?.trim();
      if (text && /^[A-Za-z0-9_-]{3,20}$/.test(text)) {
        usernames.add(text.toLowerCase());
      }
    });

    // Strategy 4: Search for u/username patterns in visible text
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent || '';
      const matches = text.matchAll(/(?:^|[\s,])u\/([A-Za-z0-9_-]{3,20})/g);
      for (const m of matches) {
        usernames.add(m[1].toLowerCase());
      }
    }

    return Array.from(usernames);
  }

  // ---- Storage ----
  function storeUsernames(newUsernames) {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const existing = new Set(result[STORAGE_KEY] || []);
      let changed = false;
      for (const u of newUsernames) {
        if (!existing.has(u)) {
          existing.add(u);
          changed = true;
        }
      }
      if (changed) {
        const all = Array.from(existing);
        chrome.storage.local.set({ [STORAGE_KEY]: all });
        // Notify background script
        chrome.runtime.sendMessage(
          { type: 'STORE_CHAT_USERNAMES', usernames: all },
          () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
      }
    });
  }

  // ---- Scanning Logic ----
  function isOnChatPage() {
    return (
      location.pathname.includes('/chat') ||
      location.pathname.includes('/message') ||
      location.hostname === 'chat.reddit.com'
    );
  }

  function startScanning() {
    // Initial scan
    const found = scanChatDOM();
    if (found.length > 0) storeUsernames(found);

    // Watch for DOM changes (React re-renders, new conversations loading)
    const observer = new MutationObserver(() => {
      const found = scanChatDOM();
      if (found.length > 0) storeUsernames(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Periodic backup scan
    setInterval(() => {
      const found = scanChatDOM();
      if (found.length > 0) storeUsernames(found);
    }, SCAN_INTERVAL);
  }

  // On chat/message pages: actively scan
  // On other Reddit pages: single scan for any visible user links
  if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(() => {
      const found = scanChatDOM();
      if (found.length > 0) storeUsernames(found);
    }, 2000);
  }
})();
