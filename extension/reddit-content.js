// SuperReddit DM Bridge — Reddit Content Script v3
// Per-conversation detection: walks UP from each /user/ link to its container,
// checks "You:" ONLY within that container. No more full-page text scanning.

console.log('[SuperReddit] reddit-content.js v3 loaded');

(function () {
  const SCAN_INTERVAL = 3000;
  const STORAGE_KEY = 'sr_chat_usernames';
  const YOU_SENT_TO_KEY = 'sr_you_sent_to';
  const THEY_REPLIED_KEY = 'sr_they_replied';
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
  function looksLikeUsername(str) {
    if (str.length < 3 || str.length > 20) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(str)) return false;
    if (isCommonWord(str)) return false;
    if (/[0-9_-]/.test(str) || str.length >= 6) return true;
    return false;
  }

  // ---- Per-Conversation Detection (the core fix) ----

  // Walk UP from a /user/ link to find its conversation container.
  // Crosses Shadow DOM boundaries via getRootNode().host.
  // Stops at the first ancestor whose text is > username+10 chars AND < 500 chars.
  function findConversationContainer(link, username) {
    let el = link;
    let levels = 0;
    const minLen = username.length + 10;

    while (el && levels < 12) {
      // Cross Shadow DOM boundary
      if (!el.parentElement) {
        const rootNode = el.getRootNode?.();
        if (rootNode && rootNode !== document && rootNode.host) {
          el = rootNode.host;
          levels++;
          continue;
        }
        break;
      }

      el = el.parentElement;
      levels++;

      // Check if this is a good container
      const tag = el.tagName?.toLowerCase() || '';
      const role = el.getAttribute?.('role') || '';
      const isSemanticContainer =
        tag === 'div' || tag === 'li' || tag === 'section' ||
        tag.startsWith('rs-') ||
        role === 'option' || role === 'listitem' || role === 'row';

      if (!isSemanticContainer) continue;

      const text = (el.textContent || '').trim();
      if (text.length >= minLen && text.length < 500) {
        return el;
      }
    }

    return null;
  }

  // For each /user/ link, find its container and check "You:" within it.
  // Returns { youSentTo: string[], theyReplied: string[], previews: {} }
  function classifyConversations() {
    const youSentTo = new Set();
    const theyReplied = new Set();
    const previews = {};
    const processed = new Set(); // track processed usernames to avoid duplicates

    const links = deepQueryAll('a[href*="/user/"]');

    for (const link of links) {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (!match || match[1] === 'me') continue;

      const username = match[1].toLowerCase();
      if (processed.has(username)) continue;
      processed.add(username);

      const container = findConversationContainer(link, username);
      if (!container) continue;

      const containerText = (container.textContent || '').trim();

      // Check for "You:" ONLY within this container's text
      const hasYou = /\bYou:\s/.test(containerText) || /\bYou sent\b/i.test(containerText);

      if (hasYou) {
        // User sent the last message in this conversation
        youSentTo.add(username);
      } else {
        // They sent the last message (or no "You:" found = they replied)
        theyReplied.add(username);
      }

      // Extract preview text from the container
      let previewText = '';
      const youMatch = containerText.match(/\bYou:\s*(.*)/);
      if (youMatch) {
        previewText = youMatch[1].trim();
      } else {
        // Strip the username itself and clean up
        previewText = containerText
          .replace(new RegExp(username.replace(/[-_]/g, '\\$&'), 'gi'), '')
          .replace(/\b(Yesterday|Today|(\d{1,2}\/\d{1,2}\/\d{2,4}))\b.*/g, '')
          .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b.*/g, '')
          .replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/gi, '')
          .trim();
      }

      if (previewText.length > 120) previewText = previewText.substring(0, 120) + '...';

      if (previewText.length > 0) {
        previews[username] = { text: previewText, fromYou: hasYou };
      }
    }

    return {
      youSentTo: Array.from(youSentTo),
      theyReplied: Array.from(theyReplied),
      previews,
    };
  }

  // ---- Username-only scanning (no reply detection) ----
  function scanChatUsernames() {
    const usernames = new Set();

    // Strategy 1: /user/ links (most reliable)
    deepQueryAll('a[href*="/user/"]').forEach((link) => {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        usernames.add(match[1].toLowerCase());
      }
    });

    // Strategy 2: Data attributes
    deepQueryAll('[data-username], [data-author], [data-user]').forEach((el) => {
      const name = el.getAttribute('data-username') || el.getAttribute('data-author') || el.getAttribute('data-user');
      if (name && looksLikeUsername(name)) usernames.add(name.toLowerCase());
    });

    // Strategy 3: Chat conversation custom elements
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

    // Strategy 4: Sidebar conversation list
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

    return Array.from(usernames);
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

  // Common words filter
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
    'stroke-width', 'viewbox', 'xmlns', 'class', 'style', 'type',
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

  function storeResults(allUsernames, youSentTo, theyReplied, previews) {
    if (!chromeAvailable()) {
      console.warn('[SuperReddit] chrome.storage unavailable — extension context may be invalidated. Reload extension.');
      return;
    }

    // Store usernames (cumulative)
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) return;
      const existing = new Set(result[STORAGE_KEY] || []);
      let changed = false;
      for (const u of allUsernames) {
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

    // Store youSentTo (CUMULATIVE — once we know the user messaged someone, persist it)
    if (youSentTo.length > 0) {
      chrome.storage.local.get(YOU_SENT_TO_KEY, (result) => {
        if (chrome.runtime.lastError) return;
        const existing = new Set(result[YOU_SENT_TO_KEY] || []);
        let changed = false;
        for (const u of youSentTo) {
          if (!existing.has(u)) {
            existing.add(u);
            changed = true;
          }
        }
        if (changed) {
          const all = Array.from(existing);
          console.log('[SuperReddit] Storing youSentTo (cumulative):', all.length, 'total');
          chrome.storage.local.set({ [YOU_SENT_TO_KEY]: all });
          chrome.runtime.sendMessage(
            { type: 'STORE_YOU_SENT_TO', usernames: all },
            () => { if (chrome.runtime.lastError) { /* ignore */ } }
          );
        }
      });
    }

    // Store theyReplied (REPLACED each scan — current state, not cumulative)
    // When the user responds, the person leaves this list naturally
    console.log('[SuperReddit] Storing theyReplied (current state):', theyReplied.length);
    chrome.storage.local.set({ [THEY_REPLIED_KEY]: theyReplied });
    chrome.runtime.sendMessage(
      { type: 'STORE_THEY_REPLIED', usernames: theyReplied },
      () => { if (chrome.runtime.lastError) { /* ignore */ } }
    );

    // Store message previews (replaced each scan)
    if (previews && Object.keys(previews).length > 0) {
      chrome.storage.local.set({ [PREVIEWS_KEY]: previews });
      chrome.runtime.sendMessage(
        { type: 'STORE_CHAT_PREVIEWS', previews },
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

  let lastLoggedCount = 0;

  function runScan() {
    // Step 1: Discover all usernames
    const allUsernames = scanChatUsernames();

    // Step 2: Per-conversation classification
    const { youSentTo, theyReplied, previews } = classifyConversations();

    // Diagnostic logging (throttled)
    if (allUsernames.length !== lastLoggedCount) {
      lastLoggedCount = allUsernames.length;
      console.log(`[SuperReddit] Scan: ${allUsernames.length} usernames, ${youSentTo.length} youSentTo, ${theyReplied.length} theyReplied`);
      if (youSentTo.length > 0) console.log('[SuperReddit]   youSentTo:', youSentTo);
      if (theyReplied.length > 0) console.log('[SuperReddit]   theyReplied:', theyReplied);
    }

    if (allUsernames.length > 0) {
      storeResults(allUsernames, youSentTo, theyReplied, previews);
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
    const MAX_ROUNDS = 40;

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

  // ---- Send consolidated scan result to background ----
  let scanResultSent = false;

  function sendScanResult() {
    if (scanResultSent) return;

    const allUsernames = scanChatUsernames();
    const { youSentTo, theyReplied, previews } = classifyConversations();

    if (allUsernames.length > 0) {
      scanResultSent = true;
      console.log(`[SuperReddit] Sending CHAT_SCAN_RESULT: ${allUsernames.length} usernames, ${youSentTo.length} youSentTo, ${theyReplied.length} theyReplied`);
      chrome.runtime.sendMessage(
        { type: 'CHAT_SCAN_RESULT', usernames: allUsernames, youSentTo, theyReplied, previews },
        () => { if (chrome.runtime.lastError) { /* ignore */ } }
      );
    }
  }

  function startScanning() {
    setTimeout(() => {
      runScan();
      autoScrollSidebar();
    }, 3000);

    const observer = new MutationObserver(runScan);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(runScan, SCAN_INTERVAL);

    // After auto-scroll completes (~25s), send consolidated result to background
    setTimeout(sendScanResult, 25_000);
    setTimeout(sendScanResult, 8_000);
    setTimeout(sendScanResult, 15_000);
  }

  if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(runScan, 2000);
  }
})();
