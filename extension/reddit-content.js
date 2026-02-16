// SuperReddit DM Bridge — Reddit Content Script v2
// Passively reads chat conversation usernames AND reply status from the Reddit chat page.
// Reddit chat uses Shadow DOM (custom web components), so we traverse shadow roots.

console.log('[SuperReddit] reddit-content.js v2 loaded');

(function () {
  const SCAN_INTERVAL = 3000;
  const STORAGE_KEY = 'sr_chat_usernames';
  const REPLIES_KEY = 'sr_chat_replies';
  const PREVIEWS_KEY = 'sr_chat_previews';

  // ---- Shadow DOM Traversal ----
  function deepQueryAll(selector, root) {
    root = root || document;
    const results = [...root.querySelectorAll(selector)];
    const allEls = root.querySelectorAll('*');
    for (const el of allEls) {
      if (el.shadowRoot) {
        results.push(...deepQueryAll(selector, el.shadowRoot));
      }
    }
    return results;
  }

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
        for (const child of node.childNodes) walk(child);
      }
    }
    walk(root);
    return text;
  }

  // ---- Username validation ----
  // Real Reddit usernames contain letters/numbers/underscores/hyphens
  // and typically have at least one number, underscore, or hyphen, or are 5+ chars
  function looksLikeUsername(str) {
    if (str.length < 3 || str.length > 20) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(str)) return false;
    if (isCommonWord(str)) return false;
    // Must contain a digit, underscore, or hyphen, OR be reasonably long
    if (/[0-9_-]/.test(str) || str.length >= 6) return true;
    return false;
  }

  // ---- DOM Scanning ----
  function scanChatDOM() {
    const usernames = new Set();

    // Strategy 1: Deep-query links to user profiles (most reliable)
    deepQueryAll('a[href*="/user/"]').forEach((link) => {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        usernames.add(match[1].toLowerCase());
      }
    });

    // Strategy 2: Deep-query elements with data attributes
    deepQueryAll('[data-username], [data-author], [data-user]').forEach((el) => {
      const name = el.getAttribute('data-username') || el.getAttribute('data-author') || el.getAttribute('data-user');
      if (name && looksLikeUsername(name)) usernames.add(name.toLowerCase());
    });

    // Strategy 3: Deep-query chat conversation elements
    deepQueryAll(
      'rs-room, rs-conversation, rs-channel, ' +
      '[class*="conversation"] [class*="name"], ' +
      '[class*="chat"] [class*="username"], ' +
      '[class*="ChatLine"] [class*="username"], ' +
      '[data-testid*="conversation"]'
    ).forEach((el) => {
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

    // Strategy 4: Walk sidebar conversation list
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
        extractUsernameFromElement(item, usernames);
      }
    }

    // Strategy 5: Scan text for username patterns (with strict filtering)
    const allText = getDeepTextContent(document.body);
    const namePatterns = allText.matchAll(/(?:^|[\s])([A-Za-z0-9_-]{3,20})(?::\s|(?:\s+(?:Yesterday|Today|Feb|Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b))/gm);
    for (const m of namePatterns) {
      const candidate = m[1];
      if (looksLikeUsername(candidate)) {
        usernames.add(candidate.toLowerCase());
      }
    }

    // Strategy 6: Look for u/username patterns
    const uPatterns = allText.matchAll(/u\/([A-Za-z0-9_-]{3,20})/g);
    for (const m of uPatterns) {
      if (looksLikeUsername(m[1])) {
        usernames.add(m[1].toLowerCase());
      }
    }

    // Now detect replies + capture message previews
    const usernameArray = Array.from(usernames);
    const { replies, previews } = detectRepliesAndPreviews(usernameArray, allText);

    return { usernames: usernameArray, replies, previews };
  }

  // ---- Reply Detection + Message Preview Capture ----
  // Scans the full page text for each known username, checks if
  // the message preview starts with "You:" (meaning you sent last),
  // and captures the actual preview text.
  function detectRepliesAndPreviews(knownUsernames, allText) {
    const replies = new Set();
    const previews = {}; // { username: { text, fromYou } }

    // Build a set of username positions in the text
    const lowerText = allText.toLowerCase();
    const positions = [];

    for (const username of knownUsernames) {
      const lower = username.toLowerCase();
      let searchFrom = 0;
      while (searchFrom < lowerText.length) {
        const idx = lowerText.indexOf(lower, searchFrom);
        if (idx === -1) break;
        positions.push({ username: lower, index: idx, endIndex: idx + lower.length });
        searchFrom = idx + lower.length;
      }
    }

    // Sort by position
    positions.sort((a, b) => a.index - b.index);

    // For each username occurrence, look at the text between it and the next username
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const nextPos = positions[i + 1];
      const windowEnd = nextPos ? Math.min(nextPos.index, pos.endIndex + 200) : pos.endIndex + 200;

      const windowText = allText.substring(pos.endIndex, windowEnd).trim();
      if (windowText.length === 0) continue;

      // Check if "You:" appears in this window
      const youMatch = windowText.match(/\bYou:\s*(.*)/);
      const youSentMatch = windowText.match(/\bYou sent\b/i);
      const hasYouPrefix = !!youMatch || !!youSentMatch;

      // Extract the preview text
      let previewText = '';
      if (youMatch) {
        // Strip "You: " prefix to get just the message
        previewText = youMatch[1].trim();
      } else {
        // Their message — clean up timestamps and UI noise
        previewText = windowText
          .replace(/\b(Yesterday|Today|(\d{1,2}\/\d{1,2}\/\d{2,4}))\b.*/, '')
          .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b.*/, '')
          .replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/gi, '')
          .trim();
      }

      // Cap preview length
      if (previewText.length > 120) previewText = previewText.substring(0, 120) + '...';

      if (previewText.length > 0) {
        // Only keep the first (most relevant) occurrence per username
        if (!previews[pos.username]) {
          previews[pos.username] = { text: previewText, fromYou: hasYouPrefix };
        }
      }

      if (!hasYouPrefix) {
        replies.add(pos.username);
      }
    }

    return { replies: Array.from(replies), previews };
  }

  // ---- Element-level scanning ----
  // Also try to detect replies by finding small containers with usernames
  function scanContainersForReplies(knownUsernames) {
    const replies = new Set();
    const usernameSet = new Set(knownUsernames.map(u => u.toLowerCase()));

    // Find all small-ish elements that could be conversation list items
    function checkNode(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      // Only check elements of reasonable size (conversation items, not the whole page)
      const rect = node.getBoundingClientRect?.();
      if (rect && rect.height > 20 && rect.height < 200 && rect.width > 100) {
        const text = (node.textContent || '').trim();
        if (text.length > 5 && text.length < 300) {
          // Check if this element contains a known username
          const lowerText = text.toLowerCase();
          for (const username of usernameSet) {
            if (lowerText.includes(username)) {
              // Found a container with this username — check for "You:" prefix
              if (!/\bYou:\s/.test(text)) {
                replies.add(username);
              }
              break;
            }
          }
        }
      }

      // Recurse into shadow DOM
      if (node.shadowRoot) {
        for (const child of node.shadowRoot.childNodes) checkNode(child);
      }
      for (const child of node.childNodes) checkNode(child);
    }

    checkNode(document.body);
    return Array.from(replies);
  }

  function extractUsernameFromElement(el, usernames) {
    const links = el.querySelectorAll('a[href*="/user/"]');
    for (const link of links) {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        usernames.add(match[1].toLowerCase());
      }
    }

    const nameEls = el.querySelectorAll('h3, h4, strong, b, [class*="name"], [class*="title"], [class*="header"]');
    for (const nameEl of nameEls) {
      const text = nameEl.textContent?.trim();
      if (text && looksLikeUsername(text)) {
        usernames.add(text.toLowerCase());
      }
    }
  }

  // Common words filter (expanded to catch more false positives)
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
    // SVG/DOM attributes that get picked up
    'fill', 'stroke', 'width', 'height', 'path', 'circle', 'rect',
    'line', 'text', 'none', 'auto', 'inherit', 'true', 'false',
    'stroke-width', 'viewbox', 'xmlns', 'class', 'style', 'type',
    // Common short words
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

  function isCommonWord(word) {
    return COMMON_WORDS.has(word.toLowerCase());
  }

  // ---- Storage ----
  function chromeAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function storeResults(newUsernames, newReplies, newPreviews) {
    if (!chromeAvailable()) {
      console.warn('[SuperReddit] chrome.storage unavailable — extension context may be invalidated. Reload extension.');
      return;
    }

    // Store usernames (cumulative)
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) return;
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
    console.log('[SuperReddit] Storing replies:', newReplies);
    chrome.storage.local.set({ [REPLIES_KEY]: newReplies });
    chrome.runtime.sendMessage(
      { type: 'STORE_CHAT_REPLIES', replies: newReplies },
      () => { if (chrome.runtime.lastError) { /* ignore */ } }
    );

    // Store message previews (replaced each scan)
    if (newPreviews && Object.keys(newPreviews).length > 0) {
      console.log('[SuperReddit] Storing previews:', newPreviews);
      chrome.storage.local.set({ [PREVIEWS_KEY]: newPreviews });
      chrome.runtime.sendMessage(
        { type: 'STORE_CHAT_PREVIEWS', previews: newPreviews },
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

  function runScan() {
    const { usernames, replies, previews } = scanChatDOM();

    // Also try element-level reply detection as a second pass
    const containerReplies = scanContainersForReplies(usernames);
    const allReplies = [...new Set([...replies, ...containerReplies])];

    if (usernames.length > 0) {
      storeResults(usernames, allReplies, previews);
    }
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
        if (el.shadowRoot) findScrollable(el.shadowRoot);
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
        if (target.scrollTop > prevTop + 10) anyScrolled = true;
      }

      runScan();

      if (!anyScrolled || scrollRound >= MAX_ROUNDS) {
        clearInterval(scrollTimer);
        setTimeout(runScan, 1000);
      }
    }, 1000);
  }

  function startScanning() {
    setTimeout(() => {
      runScan();
      autoScrollSidebar();
    }, 3000);

    const observer = new MutationObserver(runScan);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(runScan, SCAN_INTERVAL);
  }

  if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(runScan, 2000);
  }
})();
