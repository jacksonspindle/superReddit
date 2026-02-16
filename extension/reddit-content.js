// SuperReddit DM Bridge — Reddit Content Script
// Passively reads chat conversation usernames from the Reddit chat page.
// Reddit chat uses Shadow DOM (custom web components), so we traverse shadow roots.

(function () {
  const SCAN_INTERVAL = 3000;
  const STORAGE_KEY = 'sr_chat_usernames';

  // ---- Shadow DOM Traversal ----
  // Recursively query through shadow DOM boundaries
  function deepQueryAll(selector, root) {
    root = root || document;
    const results = [...root.querySelectorAll(selector)];
    // Check all elements for shadow roots
    const allEls = root.querySelectorAll('*');
    for (const el of allEls) {
      if (el.shadowRoot) {
        results.push(...deepQueryAll(selector, el.shadowRoot));
      }
    }
    return results;
  }

  // Get ALL text content including inside shadow DOMs
  function getDeepTextContent(root) {
    root = root || document.body;
    let text = '';

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent + ' ';
      } else if (node.shadowRoot) {
        walk(node.shadowRoot);
      }
      if (node.childNodes) {
        for (const child of node.childNodes) {
          walk(child);
        }
      }
    }

    walk(root);
    return text;
  }

  // ---- DOM Scanning ----
  function scanChatDOM() {
    const usernames = new Set();

    // Strategy 1: Deep-query links to user profiles (through shadow DOM)
    deepQueryAll('a[href*="/user/"]').forEach((link) => {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        usernames.add(match[1].toLowerCase());
      }
    });

    // Strategy 2: Deep-query elements with data attributes
    deepQueryAll('[data-username], [data-author], [data-user]').forEach((el) => {
      const name = el.getAttribute('data-username') || el.getAttribute('data-author') || el.getAttribute('data-user');
      if (name) usernames.add(name.toLowerCase());
    });

    // Strategy 3: Deep-query chat conversation elements
    // Reddit chat custom elements may use specific tag names or classes
    deepQueryAll(
      'rs-room, rs-conversation, rs-channel, ' +
      '[class*="conversation"] [class*="name"], ' +
      '[class*="chat"] [class*="username"], ' +
      '[class*="ChatLine"] [class*="username"], ' +
      '[data-testid*="conversation"]'
    ).forEach((el) => {
      // Check shadow root content
      if (el.shadowRoot) {
        const innerLinks = el.shadowRoot.querySelectorAll('a[href*="/user/"]');
        innerLinks.forEach((link) => {
          const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
          if (match && match[1] !== 'me') {
            usernames.add(match[1].toLowerCase());
          }
        });
      }
    });

    // Strategy 4: Walk the sidebar conversation list looking for username text
    // Reddit chat sidebar has conversation items with username + preview text
    // Find the sidebar/channel-list and extract names
    const sidebarCandidates = deepQueryAll(
      '[class*="sidebar"], [class*="channel-list"], [class*="conversation-list"], ' +
      '[class*="ThreadList"], [class*="room-list"], [role="listbox"], [role="list"]'
    );

    for (const sidebar of sidebarCandidates) {
      const root = sidebar.shadowRoot || sidebar;
      // Look for list items that contain usernames
      const items = root.querySelectorAll(
        '[role="option"], [role="listitem"], li, [class*="item"], [class*="thread"], [class*="conversation"]'
      );
      for (const item of items) {
        extractUsernameFromElement(item, usernames);
      }
    }

    // Strategy 5: Scan all text in shadow DOMs for username patterns
    const allText = getDeepTextContent(document.body);
    // Match standalone usernames that appear in conversation context
    // Look for patterns like "username:" or "username Feb 14" that appear in chat lists
    const namePatterns = allText.matchAll(/(?:^|[\s])([A-Za-z0-9_-]{3,20})(?::\s|(?:\s+(?:Yesterday|Today|Feb|Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b))/gm);
    for (const m of namePatterns) {
      const candidate = m[1];
      // Filter out common non-username words
      if (!isCommonWord(candidate)) {
        usernames.add(candidate.toLowerCase());
      }
    }

    // Strategy 6: Look for u/username patterns
    const uPatterns = allText.matchAll(/u\/([A-Za-z0-9_-]{3,20})/g);
    for (const m of uPatterns) {
      usernames.add(m[1].toLowerCase());
    }

    return Array.from(usernames);
  }

  function extractUsernameFromElement(el, usernames) {
    // Check for user profile links
    const links = el.querySelectorAll('a[href*="/user/"]');
    for (const link of links) {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        usernames.add(match[1].toLowerCase());
      }
    }

    // Check text content for username-like strings
    // In Reddit chat, the first bold/prominent text in a conversation item is usually the username
    const nameEls = el.querySelectorAll('h3, h4, strong, b, [class*="name"], [class*="title"], [class*="header"]');
    for (const nameEl of nameEls) {
      const text = nameEl.textContent?.trim();
      if (text && /^[A-Za-z0-9_-]{3,20}$/.test(text) && !isCommonWord(text)) {
        usernames.add(text.toLowerCase());
      }
    }
  }

  // Filter out common English words that could be false positives
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
  ]);

  function isCommonWord(word) {
    return COMMON_WORDS.has(word.toLowerCase());
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
    // Initial scan after a delay (let shadow DOM components mount)
    setTimeout(() => {
      const found = scanChatDOM();
      if (found.length > 0) storeUsernames(found);
    }, 2000);

    // Watch for DOM changes including shadow DOM component mounts
    const observer = new MutationObserver(() => {
      const found = scanChatDOM();
      if (found.length > 0) storeUsernames(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Periodic scan (shadow DOM changes may not trigger MutationObserver)
    setInterval(() => {
      const found = scanChatDOM();
      if (found.length > 0) storeUsernames(found);
    }, SCAN_INTERVAL);
  }

  if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(() => {
      const found = scanChatDOM();
      if (found.length > 0) storeUsernames(found);
    }, 2000);
  }
})();
