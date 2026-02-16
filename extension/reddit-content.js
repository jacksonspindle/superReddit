// SuperReddit DM Bridge — Reddit Content Script
// Passively reads chat conversation usernames AND reply status from the Reddit chat page.
// Reddit chat uses Shadow DOM (custom web components), so we traverse shadow roots.

(function () {
  const SCAN_INTERVAL = 3000;
  const STORAGE_KEY = 'sr_chat_usernames';
  const REPLIES_KEY = 'sr_chat_replies';

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
    const replies = new Set(); // usernames where THEY sent the last message

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

    // Strategy 4: Walk the sidebar conversation list — extract usernames AND reply status
    const sidebarCandidates = deepQueryAll(
      '[class*="sidebar"], [class*="channel-list"], [class*="conversation-list"], ' +
      '[class*="ThreadList"], [class*="room-list"], [role="listbox"], [role="list"]'
    );

    for (const sidebar of sidebarCandidates) {
      const root = sidebar.shadowRoot || sidebar;
      const items = root.querySelectorAll(
        '[role="option"], [role="listitem"], li, [class*="item"], [class*="thread"], [class*="conversation"]'
      );
      for (const item of items) {
        const result = analyzeConversationItem(item);
        if (result) {
          usernames.add(result.username);
          if (result.theyReplied) {
            replies.add(result.username);
          }
        }
      }
    }

    // Strategy 5: Scan all text in shadow DOMs for username patterns
    const allText = getDeepTextContent(document.body);
    const namePatterns = allText.matchAll(/(?:^|[\s])([A-Za-z0-9_-]{3,20})(?::\s|(?:\s+(?:Yesterday|Today|Feb|Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b))/gm);
    for (const m of namePatterns) {
      const candidate = m[1];
      if (!isCommonWord(candidate)) {
        usernames.add(candidate.toLowerCase());
      }
    }

    // Strategy 6: Look for u/username patterns
    const uPatterns = allText.matchAll(/u\/([A-Za-z0-9_-]{3,20})/g);
    for (const m of uPatterns) {
      usernames.add(m[1].toLowerCase());
    }

    return { usernames: Array.from(usernames), replies: Array.from(replies) };
  }

  // Analyze a single conversation item for username + reply status
  function analyzeConversationItem(item) {
    let username = null;
    const root = item.shadowRoot || item;

    // Try profile links first
    const links = root.querySelectorAll('a[href*="/user/"]');
    for (const link of links) {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        username = match[1].toLowerCase();
        break;
      }
    }

    // Try name elements (bold/heading text that looks like a username)
    if (!username) {
      const nameEls = root.querySelectorAll('h3, h4, strong, b, [class*="name"], [class*="title"], [class*="header"]');
      for (const el of nameEls) {
        const text = el.textContent?.trim();
        if (text && /^[A-Za-z0-9_-]{3,20}$/.test(text) && !isCommonWord(text)) {
          username = text.toLowerCase();
          break;
        }
      }
    }

    if (!username) return null;

    // Analyze message preview to determine who sent the last message
    // Reddit chat shows "You: <message>" when you sent the last message
    // and just "<message>" when they sent the last message
    const fullText = getDeepTextContent(item);

    // Look for "You:" pattern indicating you sent the last message
    // Be careful to match the preview text, not the username itself
    const youSentLast = /\bYou:\s/.test(fullText);

    // Also check for unread indicators (strong signal they replied)
    const hasUnread = !!(
      root.querySelector('[class*="unread"], [class*="Unread"], [class*="badge"], [class*="Badge"]') ||
      root.querySelector('[aria-label*="unread"]') ||
      // Bold/highlighted conversation names often indicate unread
      root.querySelector('[class*="bold"], [class*="Bold"], [style*="font-weight"]')
    );

    // They replied if:
    // 1. The preview does NOT start with "You:" (they sent the last message), OR
    // 2. There's an unread indicator
    const theyReplied = !youSentLast || hasUnread;

    return { username, theyReplied };
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
  function storeResults(newUsernames, newReplies) {
    // Store usernames (cumulative — grows over time)
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

    // Store replies (replaced each scan — reflects current state)
    if (newReplies.length > 0) {
      chrome.storage.local.set({ [REPLIES_KEY]: newReplies });
      chrome.runtime.sendMessage(
        { type: 'STORE_CHAT_REPLIES', replies: newReplies },
        () => { if (chrome.runtime.lastError) { /* ignore */ } }
      );
    }
  }

  // ---- Scanning Logic ----
  function isOnChatPage() {
    return (
      location.pathname.includes('/chat') ||
      location.pathname.includes('/message') ||
      location.hostname === 'chat.reddit.com'
    );
  }

  // ---- Auto-scroll sidebar to load all conversations ----
  function autoScrollSidebar() {
    const candidates = deepQueryAll(
      '[class*="sidebar"], [class*="channel-list"], [class*="conversation-list"], ' +
      '[class*="ThreadList"], [class*="room-list"], [role="listbox"], [role="list"], ' +
      'nav, aside'
    );

    const allScrollable = [];
    function findScrollable(root) {
      const els = (root || document).querySelectorAll('*');
      for (const el of els) {
        if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 100) {
          allScrollable.push(el);
        }
        if (el.shadowRoot) {
          findScrollable(el.shadowRoot);
        }
      }
    }
    findScrollable();

    const scrollTargets = [...new Set([...candidates, ...allScrollable])];
    if (scrollTargets.length === 0) return;

    let scrollRound = 0;
    const MAX_ROUNDS = 20;

    const scrollTimer = setInterval(() => {
      scrollRound++;
      let anyScrolled = false;

      for (const target of scrollTargets) {
        const prevTop = target.scrollTop;
        target.scrollTop = target.scrollHeight;
        if (target.scrollTop > prevTop + 10) {
          anyScrolled = true;
        }
      }

      // Scan after each scroll
      const { usernames, replies } = scanChatDOM();
      if (usernames.length > 0) storeResults(usernames, replies);

      if (!anyScrolled || scrollRound >= MAX_ROUNDS) {
        clearInterval(scrollTimer);
        setTimeout(() => {
          const { usernames, replies } = scanChatDOM();
          if (usernames.length > 0) storeResults(usernames, replies);
        }, 1000);
      }
    }, 1000);
  }

  function startScanning() {
    setTimeout(() => {
      const { usernames, replies } = scanChatDOM();
      if (usernames.length > 0) storeResults(usernames, replies);
      autoScrollSidebar();
    }, 3000);

    const observer = new MutationObserver(() => {
      const { usernames, replies } = scanChatDOM();
      if (usernames.length > 0) storeResults(usernames, replies);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
      const { usernames, replies } = scanChatDOM();
      if (usernames.length > 0) storeResults(usernames, replies);
    }, SCAN_INTERVAL);
  }

  if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(() => {
      const { usernames, replies } = scanChatDOM();
      if (usernames.length > 0) storeResults(usernames, replies);
    }, 2000);
  }
})();
