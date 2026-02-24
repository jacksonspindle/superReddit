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
  const CHAT_URLS_KEY = 'sr_chat_urls';

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
  // Reddit chat uses <a href="/room/..."> with <span class="room-name"> for usernames
  // and aria-label="Direct chat with USERNAME" on each conversation item.
  // Message previews show "You: message" or "Username: message" in the second row.

  function classifyConversations() {
    const youSentTo = new Set();
    const theyReplied = new Set();
    const previews = {};
    const chatUrls = {};
    const processed = new Set();

    // Strategy A: Find conversation items via aria-label (most reliable)
    const chatLinks = deepQueryAll('a[aria-label*="Direct chat with"]');
    for (const link of chatLinks) {
      const label = link.getAttribute('aria-label') || '';
      const match = label.match(/Direct chat with\s+(.+)/i);
      if (!match) continue;

      const username = match[1].trim().toLowerCase();
      if (processed.has(username) || isCommonWord(username)) continue;
      processed.add(username);

      // Capture chat URL for direct navigation
      const href = link.getAttribute('href');
      if (href && href.length > 1 && href !== '#') {
        // Reddit links use /room/!MATRIX_ID but actual URL needs /chat prefix
        let chatPath = href;
        if (chatPath.startsWith('/room/') && !chatPath.startsWith('/chat/')) {
          chatPath = '/chat' + chatPath;
        }
        chatUrls[username] = chatPath;
      }

      // The full text of the <a> contains: "Username  Yesterday  Username: message preview"
      // or "Username  Yesterday  You: message preview"
      const itemText = (link.textContent || '').trim();
      const hasYou = /\bYou:\s/.test(itemText) || /\bYou sent\b/i.test(itemText);

      if (hasYou) {
        youSentTo.add(username);
      } else {
        theyReplied.add(username);
      }

      // Extract preview from the item text
      let previewText = '';
      const youMatch = itemText.match(/\bYou:\s*(.*)/);
      if (youMatch) {
        previewText = youMatch[1].trim();
      } else {
        // Look for "Username: message" pattern
        const escapedName = username.replace(/[-_]/g, '\\$&');
        const theirMatch = itemText.match(new RegExp(escapedName + ':\\s*(.*)', 'i'));
        if (theirMatch) {
          previewText = theirMatch[1].trim();
        }
      }
      // Clean up timestamps from preview
      previewText = previewText
        .replace(/\b(Yesterday|Today)\b.*$/g, '')
        .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b.*$/g, '')
        .replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/gi, '')
        .trim();
      if (previewText.length > 120) previewText = previewText.substring(0, 120) + '...';
      if (previewText.length > 0) {
        previews[username] = { text: previewText, fromYou: hasYou };
      }
    }

    // Strategy B: Find via span.room-name (fallback)
    if (processed.size === 0) {
      const roomNames = deepQueryAll('span.room-name, [class*="room-name"]');
      for (const span of roomNames) {
        const username = (span.textContent || '').trim().toLowerCase();
        if (!username || processed.has(username) || isCommonWord(username)) continue;
        if (username.length < 3 || username.length > 20) continue;
        processed.add(username);

        // Walk up to the conversation item (<a> parent)
        let container = span;
        for (let i = 0; i < 8; i++) {
          if (!container.parentElement) {
            const rn = container.getRootNode?.();
            if (rn && rn !== document && rn.host) { container = rn.host; continue; }
            break;
          }
          container = container.parentElement;
          if (container.tagName === 'A') break;
        }

        const itemText = (container.textContent || '').trim();
        const hasYou = /\bYou:\s/.test(itemText) || /\bYou sent\b/i.test(itemText);

        if (hasYou) {
          youSentTo.add(username);
        } else {
          theyReplied.add(username);
        }
      }
    }

    // Strategy C: /user/ links (for profile popups, etc.)
    const userLinks = deepQueryAll('a[href*="/user/"]');
    for (const link of userLinks) {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (!match || match[1] === 'me') continue;
      const username = match[1].toLowerCase();
      if (processed.has(username)) continue;
      // Don't classify these — just note the username exists
      processed.add(username);
    }

    // If someone replied, you must have messaged them first — add to youSentTo too.
    // This ensures the pipeline can advance: Ready → DM Sent → Responded
    for (const u of theyReplied) {
      youSentTo.add(u);
    }

    console.log('[SuperReddit] classify: ' + processed.size + ' users, ' + youSentTo.size + ' youSentTo, ' + theyReplied.size + ' theyReplied (via ' + chatLinks.length + ' aria-labels), ' + Object.keys(chatUrls).length + ' chatUrls');
    if (youSentTo.size > 0) console.log('[SuperReddit]   youSentTo:', Array.from(youSentTo));
    if (theyReplied.size > 0) console.log('[SuperReddit]   theyReplied:', Array.from(theyReplied));
    if (Object.keys(chatUrls).length > 0) console.log('[SuperReddit]   chatUrls:', chatUrls);
    // Debug: log first few link hrefs to diagnose chatUrl capture
    if (Object.keys(chatUrls).length === 0 && chatLinks.length > 0) {
      var sampleHrefs = [];
      for (var di = 0; di < Math.min(3, chatLinks.length); di++) {
        var dLink = chatLinks[di];
        sampleHrefs.push({
          label: (dLink.getAttribute('aria-label') || '').substring(0, 50),
          href: dLink.getAttribute('href'),
          tagName: dLink.tagName,
        });
      }
      console.log('[SuperReddit]   DEBUG: no chatUrls captured. Sample links:', sampleHrefs);
    }

    return {
      youSentTo: Array.from(youSentTo),
      theyReplied: Array.from(theyReplied),
      previews,
      chatUrls,
    };
  }

  // ---- Username-only scanning ----
  function scanChatUsernames() {
    const usernames = new Set();

    // Strategy 1: aria-label on conversation links (Reddit's actual DOM)
    deepQueryAll('a[aria-label*="Direct chat with"]').forEach((link) => {
      const label = link.getAttribute('aria-label') || '';
      const match = label.match(/Direct chat with\s+(.+)/i);
      if (match) {
        const name = match[1].trim();
        if (name.length >= 3 && name.length <= 20 && !isCommonWord(name)) {
          usernames.add(name.toLowerCase());
        }
      }
    });

    // Strategy 2: span.room-name elements
    deepQueryAll('span.room-name, [class*="room-name"]').forEach((el) => {
      const name = (el.textContent || '').trim();
      if (name && looksLikeUsername(name)) usernames.add(name.toLowerCase());
    });

    // Strategy 3: /user/ links (profile popups, etc.)
    deepQueryAll('a[href*="/user/"]').forEach((link) => {
      const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (match && match[1] !== 'me') {
        usernames.add(match[1].toLowerCase());
      }
    });

    // Strategy 4: Data attributes
    deepQueryAll('[data-username], [data-author], [data-user]').forEach((el) => {
      const name = el.getAttribute('data-username') || el.getAttribute('data-author') || el.getAttribute('data-user');
      if (name && looksLikeUsername(name)) usernames.add(name.toLowerCase());
    });

    // Strategy 5: rs-room-icon custom elements (Reddit chat avatars)
    deepQueryAll('rs-room-icon').forEach((el) => {
      const room = el.getAttribute('room') || '';
      // The room attribute contains room IDs, but the parent may have username info
      const parent = el.parentElement;
      if (parent) {
        const label = parent.getAttribute('aria-label') || '';
        const match = label.match(/Direct chat with\s+(.+)/i);
        if (match) {
          const name = match[1].trim();
          if (name.length >= 3 && name.length <= 20) usernames.add(name.toLowerCase());
        }
      }
    });

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

  function storeResults(allUsernames, youSentTo, theyReplied, previews, chatUrls) {
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

    // Store theyReplied (CUMULATIVE — same as youSentTo)
    // Virtual scroll means we only see ~16 items at a time, so we must accumulate.
    if (theyReplied.length > 0) {
      chrome.storage.local.get(THEY_REPLIED_KEY, (result) => {
        if (chrome.runtime.lastError) return;
        const existing = new Set(result[THEY_REPLIED_KEY] || []);
        let changed = false;
        for (const u of theyReplied) {
          if (!existing.has(u)) {
            existing.add(u);
            changed = true;
          }
        }
        if (changed) {
          const all = Array.from(existing);
          console.log('[SuperReddit] Storing theyReplied (cumulative):', all.length, 'total');
          chrome.storage.local.set({ [THEY_REPLIED_KEY]: all });
          chrome.runtime.sendMessage(
            { type: 'STORE_THEY_REPLIED', usernames: all },
            () => { if (chrome.runtime.lastError) { /* ignore */ } }
          );
        }
      });
    }

    // Store message previews (CUMULATIVE — merge with existing, don't replace)
    // Each preview stores: { text, fromYou, theirText }
    //   text/fromYou = latest message in the conversation
    //   theirText = their last message to you (NEVER overwritten by your replies)
    if (previews && Object.keys(previews).length > 0) {
      chrome.storage.local.get(PREVIEWS_KEY, (result) => {
        if (chrome.runtime.lastError) return;
        const existing = result[PREVIEWS_KEY] || {};
        const merged = { ...existing };
        for (const [username, newP] of Object.entries(previews)) {
          const old = merged[username];
          // Determine theirText: their last message to you (never lost when you reply)
          let theirText = null;
          if (!newP.fromYou) {
            // Current message IS from them — use it
            theirText = newP.text;
          } else if (old) {
            // Current message is from you — preserve their previous reply
            theirText = old.theirText || (!old.fromYou ? old.text : null);
          }
          merged[username] = { text: newP.text, fromYou: newP.fromYou, theirText };
        }
        chrome.storage.local.set({ [PREVIEWS_KEY]: merged });
        chrome.runtime.sendMessage(
          { type: 'STORE_CHAT_PREVIEWS', previews: merged },
          () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
      });
    }

    // Store chat URLs (cumulative — merge with existing)
    if (chatUrls && Object.keys(chatUrls).length > 0) {
      chrome.storage.local.get(CHAT_URLS_KEY, (result) => {
        if (chrome.runtime.lastError) return;
        const existing = result[CHAT_URLS_KEY] || {};
        const merged = { ...existing, ...chatUrls };
        chrome.storage.local.set({ [CHAT_URLS_KEY]: merged });
        chrome.runtime.sendMessage(
          { type: 'STORE_CHAT_URLS', chatUrls: merged },
          () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
      });
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
  let autoScrollTriggered = false;
  let autoScrollRunning = false;
  let lastAutoScrollTime = 0;
  // Re-run auto-scroll every 5 minutes + random jitter (0-60s) to look human
  const AUTO_SCROLL_BASE = 5 * 60 * 1000;
  function autoScrollInterval() { return AUTO_SCROLL_BASE + Math.random() * 60_000; }

  function runScan() {
    // Step 1: Discover all usernames
    const allUsernames = scanChatUsernames();

    // Step 2: Per-conversation classification
    const { youSentTo, theyReplied, previews, chatUrls } = classifyConversations();

    // Diagnostic logging (throttled)
    if (allUsernames.length !== lastLoggedCount) {
      lastLoggedCount = allUsernames.length;
      console.log(`[SuperReddit] Scan: ${allUsernames.length} usernames, ${youSentTo.length} youSentTo, ${theyReplied.length} theyReplied`);
      if (youSentTo.length > 0) console.log('[SuperReddit]   youSentTo:', youSentTo);
      if (theyReplied.length > 0) console.log('[SuperReddit]   theyReplied:', theyReplied);
    }

    if (allUsernames.length > 0) {
      // Cache for pull requests from background.js (GET_SCAN_DATA)
      latestScanData = { usernames: allUsernames, youSentTo, theyReplied, previews, chatUrls };

      storeResults(allUsernames, youSentTo, theyReplied, previews, chatUrls);

      // Trigger auto-scroll on first detection, then re-run periodically
      const now = Date.now();
      if (!autoScrollTriggered) {
        autoScrollTriggered = true;
        console.log('[SuperReddit] Usernames detected — starting auto-scroll');
        setTimeout(autoScrollSidebar, 500);
      } else if (!autoScrollRunning && now - lastAutoScrollTime > autoScrollInterval()) {
        console.log('[SuperReddit] Periodic auto-scroll (picks up new conversations)');
        setTimeout(autoScrollSidebar, 500);
      }
    }
  }

  // ---- Auto-scroll sidebar to load all conversations ----

  function findAllScrollable() {
    const results = [];
    function scan(root) {
      const els = (root || document).querySelectorAll('*');
      for (const el of els) {
        try {
          // Check computed overflow style
          const style = window.getComputedStyle(el);
          const oy = style.overflowY;
          if ((oy === 'auto' || oy === 'scroll') && el.clientHeight > 50) {
            results.push(el);
          }
        } catch (e) { /* skip */ }
        if (el.shadowRoot) scan(el.shadowRoot);
      }
    }
    scan();
    return results;
  }

  function autoScrollSidebar() {
    // Skip auto-scroll when the user is actively using the page (tab is focused).
    // Only scroll in background tabs where it won't disrupt the user.
    if (document.hasFocus()) {
      console.log('[SuperReddit] Auto-scroll: skipped — tab is focused (user is active)');
      // Still capture what's currently visible without scrolling
      var visibleUsernames = scanChatUsernames();
      var visibleData = classifyConversations();
      if (visibleUsernames.length > 0) {
        latestScanData = {
          usernames: visibleUsernames,
          youSentTo: visibleData.youSentTo,
          theyReplied: visibleData.theyReplied,
          previews: visibleData.previews,
          chatUrls: visibleData.chatUrls,
        };
        storeResults(visibleUsernames, visibleData.youSentTo, visibleData.theyReplied, visibleData.previews, visibleData.chatUrls);
      }
      return;
    }

    autoScrollRunning = true;
    lastAutoScrollTime = Date.now();

    const convLinks = deepQueryAll('a[aria-label*="Direct chat with"]');
    if (convLinks.length === 0) {
      console.log('[SuperReddit] Auto-scroll: no conversation links, skipping');
      autoScrollRunning = false;
      return;
    }

    // Find all scrollable containers in the entire DOM (including Shadow DOM)
    const scrollables = findAllScrollable();
    console.log('[SuperReddit] Found ' + scrollables.length + ' scrollable containers:');
    for (const sc of scrollables) {
      console.log('[SuperReddit]   ' + sc.tagName +
        ' class="' + (sc.className || '').toString().substring(0, 50) + '"' +
        ' w=' + sc.clientWidth + ' h=' + sc.clientHeight +
        ' scrollH=' + sc.scrollHeight +
        ' canScroll=' + (sc.scrollHeight > sc.clientHeight + 10));
    }

    // The sidebar conversation list is the narrow scrollable container (< ~400px wide)
    // that can actually scroll (scrollHeight > clientHeight)
    let sidebarContainer = null;
    const narrowScrollable = scrollables
      .filter(sc => sc.clientWidth > 100 && sc.clientWidth < 500 && sc.scrollHeight > sc.clientHeight + 10)
      .sort((a, b) => b.scrollHeight - a.scrollHeight);

    if (narrowScrollable.length > 0) {
      sidebarContainer = narrowScrollable[0];
      console.log('[SuperReddit] Using sidebar container: ' + sidebarContainer.tagName +
        ' w=' + sidebarContainer.clientWidth + ' scrollH=' + sidebarContainer.scrollHeight);
    }

    // Fallback: try any scrollable container that can scroll
    if (!sidebarContainer) {
      const anyScrollable = scrollables
        .filter(sc => sc.scrollHeight > sc.clientHeight + 50)
        .sort((a, b) => b.scrollHeight - a.scrollHeight);
      if (anyScrollable.length > 0) {
        sidebarContainer = anyScrollable[0];
        console.log('[SuperReddit] Fallback container: ' + sidebarContainer.tagName +
          ' w=' + sidebarContainer.clientWidth + ' scrollH=' + sidebarContainer.scrollHeight);
      }
    }

    if (!sidebarContainer) {
      console.log('[SuperReddit] No scrollable sidebar found — cannot auto-scroll');
      return;
    }

    // RS-VIRTUAL-SCROLL is a custom element — check if the real scrollable is inside its shadow root
    let scrollTarget = sidebarContainer;
    if (sidebarContainer.shadowRoot) {
      const innerEls = sidebarContainer.shadowRoot.querySelectorAll('*');
      for (const el of innerEls) {
        try {
          const style = window.getComputedStyle(el);
          const oy = style.overflowY;
          if ((oy === 'auto' || oy === 'scroll') && el.clientHeight > 50) {
            console.log('[SuperReddit] Found inner scrollable: ' + el.tagName +
              ' scrollH=' + el.scrollHeight + ' clientH=' + el.clientHeight);
            if (el.scrollHeight > el.clientHeight + 10) {
              scrollTarget = el;
            }
          }
        } catch (e) { /* skip */ }
      }
    }

    console.log('[SuperReddit] Scroll target: ' + scrollTarget.tagName +
      ' scrollH=' + scrollTarget.scrollHeight + ' h=' + scrollTarget.clientHeight +
      ' scrollTop=' + scrollTarget.scrollTop);

    // Virtual scroll: Reddit only renders ~16 items at a time.
    // We must accumulate usernames across scroll positions.
    const accumulated = { usernames: new Set(), youSentTo: new Set(), theyReplied: new Set(), previews: {}, chatUrls: {} };

    // Capture what's visible now (before scrolling)
    function captureVisible() {
      const { youSentTo, theyReplied, previews, chatUrls } = classifyConversations();
      const usernames = scanChatUsernames();
      for (const u of usernames) accumulated.usernames.add(u);
      for (const u of youSentTo) accumulated.youSentTo.add(u);
      for (const u of theyReplied) accumulated.theyReplied.add(u);
      // Merge chatUrls
      for (const [username, url] of Object.entries(chatUrls)) {
        accumulated.chatUrls[username] = url;
      }
      // Merge previews preserving theirText (their last reply to you)
      for (const [username, newP] of Object.entries(previews)) {
        const old = accumulated.previews[username];
        let theirText = null;
        if (!newP.fromYou) {
          theirText = newP.text;
        } else if (old) {
          theirText = old.theirText || (!old.fromYou ? old.text : null);
        }
        accumulated.previews[username] = { text: newP.text, fromYou: newP.fromYou, theirText };
      }
    }

    captureVisible();
    console.log('[SuperReddit] Auto-scroll: starting with ' + accumulated.usernames.size + ' unique users');

    let scrollRound = 0;
    const MAX_ROUNDS = 40;
    let staleRounds = 0;

    // Randomized scroll speed (800-1600ms) to look human
    const scrollTimer = setInterval(() => {
      // Stop immediately if the user focuses the tab mid-scroll
      if (document.hasFocus()) {
        clearInterval(scrollTimer);
        console.log('[SuperReddit] Auto-scroll: stopped — user focused the tab');
        scrollTarget.scrollTop = 0;
        if (scrollTarget !== sidebarContainer) sidebarContainer.scrollTop = 0;
        autoScrollRunning = false;

        // Still store whatever we've accumulated so far
        var partial = Array.from(accumulated.usernames);
        if (partial.length > 0) {
          storeResults(partial, Array.from(accumulated.youSentTo), Array.from(accumulated.theyReplied), accumulated.previews, accumulated.chatUrls);
        }
        return;
      }

      scrollRound++;

      const prevTop = scrollTarget.scrollTop;
      const scrollAmount = Math.max(scrollTarget.clientHeight * 0.7, 300);
      scrollTarget.scrollTop += scrollAmount;

      // Dispatch scroll event to trigger virtual scroll component update
      scrollTarget.dispatchEvent(new Event('scroll', { bubbles: true }));
      if (scrollTarget !== sidebarContainer) {
        sidebarContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      }

      const newTop = scrollTarget.scrollTop;
      const scrolled = newTop > prevTop + 5;

      // Capture usernames at this scroll position
      const prevSize = accumulated.usernames.size;
      captureVisible();
      const newSize = accumulated.usernames.size;

      if (newSize > prevSize) {
        console.log('[SuperReddit] Round ' + scrollRound + ': ' + prevSize + ' → ' + newSize + ' unique users (scrollTop=' + newTop.toFixed(0) + ')');
        staleRounds = 0;
      } else {
        staleRounds++;
      }

      if (scrollRound <= 3) {
        console.log('[SuperReddit] Round ' + scrollRound + ': scrollTop ' + prevTop.toFixed(0) + ' → ' + newTop.toFixed(0) + ' scrolled=' + scrolled + ' users=' + newSize);
      }

      // Stop if: no scroll AND no new users for 5 rounds, or max rounds
      if ((!scrolled && staleRounds >= 5) || scrollRound >= MAX_ROUNDS) {
        clearInterval(scrollTimer);

        const finalUsernames = Array.from(accumulated.usernames);
        const finalYouSentTo = Array.from(accumulated.youSentTo);
        const finalTheyReplied = Array.from(accumulated.theyReplied);

        console.log('[SuperReddit] Auto-scroll DONE: ' + finalUsernames.length + ' users, ' +
          finalYouSentTo.length + ' youSentTo, ' + finalTheyReplied.length + ' theyReplied (' + scrollRound + ' rounds)');
        console.log('[SuperReddit]   youSentTo:', finalYouSentTo);
        console.log('[SuperReddit]   theyReplied:', finalTheyReplied);

        // Update in-memory cache for pull requests (GET_SCAN_DATA)
        latestScanData = {
          usernames: finalUsernames,
          youSentTo: finalYouSentTo,
          theyReplied: finalTheyReplied,
          previews: accumulated.previews,
          chatUrls: accumulated.chatUrls,
        };

        // Store accumulated results
        storeResults(finalUsernames, finalYouSentTo, finalTheyReplied, accumulated.previews, accumulated.chatUrls);

        // Also send to background immediately via message (in case storage writes fail)
        try {
          chrome.runtime.sendMessage(
            { type: 'CHAT_SCAN_RESULT', usernames: finalUsernames, youSentTo: finalYouSentTo, theyReplied: finalTheyReplied, previews: accumulated.previews, chatUrls: accumulated.chatUrls },
            () => { if (chrome.runtime.lastError) { /* ignore */ } }
          );
        } catch (e) { /* orphaned context */ }

        // Scroll back to top
        scrollTarget.scrollTop = 0;
        if (scrollTarget !== sidebarContainer) sidebarContainer.scrollTop = 0;
        autoScrollRunning = false;
      }
    }, 800 + Math.random() * 800); // 800-1600ms randomized
  }

  // ---- Send consolidated scan result to background ----
  let lastSentCount = 0;

  function sendScanResult() {
    const allUsernames = scanChatUsernames();
    const { youSentTo, theyReplied, previews, chatUrls } = classifyConversations();

    // Only send if we have new data
    if (allUsernames.length > 0 && allUsernames.length !== lastSentCount) {
      lastSentCount = allUsernames.length;
      console.log(`[SuperReddit] Sending CHAT_SCAN_RESULT: ${allUsernames.length} usernames, ${youSentTo.length} youSentTo, ${theyReplied.length} theyReplied`);
      chrome.runtime.sendMessage(
        { type: 'CHAT_SCAN_RESULT', usernames: allUsernames, youSentTo, theyReplied, previews, chatUrls },
        () => { if (chrome.runtime.lastError) { /* ignore */ } }
      );
    }
  }

  function startScanning() {
    // Start scanning after a short delay — auto-scroll triggers automatically
    // when runScan() first detects real usernames
    setTimeout(runScan, 2000);

    const observer = new MutationObserver(runScan);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(runScan, SCAN_INTERVAL);

    // Send results at intervals — sendScanResult is idempotent (only sends if count changed)
    setTimeout(sendScanResult, 10_000);
    setTimeout(sendScanResult, 20_000);
    setTimeout(sendScanResult, 40_000);
    setTimeout(sendScanResult, 60_000);
  }

  // ---- Pull API: background.js can request current scan data directly ----
  // This bypasses chrome.storage issues with orphaned content scripts.
  // The background service worker uses chrome.tabs.sendMessage() to pull data.
  let latestScanData = { usernames: [], youSentTo: [], theyReplied: [], previews: {}, chatUrls: {} };

  // ---- Fetch target hint ----
  // A time-limited hint from background.js telling us which user's conversation
  // we're currently trying to fetch. Used ONLY as a fallback when
  // identifyConversationUser() returns null (can't determine the partner from
  // message authors alone). Expires after 15 seconds to prevent leaking to
  // future conversations.
  let _fetchTarget = null; // { username: string, setAt: number }
  const FETCH_TARGET_TTL = 15_000;

  function getActiveFetchTarget() {
    if (!_fetchTarget) return null;
    if (Date.now() - _fetchTarget.setAt > FETCH_TARGET_TTL) {
      _fetchTarget = null;
      return null;
    }
    return _fetchTarget.username;
  }

  function consumeFetchTarget() {
    const target = getActiveFetchTarget();
    _fetchTarget = null; // one-time use
    return target;
  }

  // ---- Identify the currently open/active chat conversation partner ----
  // IMPORTANT: All strategies here MUST depend on actual rendered DOM state,
  // NOT the URL. The URL changes immediately on navigation but the DOM/SPA
  // may still be rendering the previous conversation. URL-based checks would
  // falsely validate stale content, causing cross-contamination.
  function identifyOpenChatPartner() {
    const chatLinks = deepQueryAll('a[aria-label*="Direct chat with"]');
    if (chatLinks.length === 0) return null;

    // Strategy 1: Explicit active/selected state attributes on sidebar links.
    // These are set by the chat app when it actually renders a conversation.
    for (const link of chatLinks) {
      const ariaCurrent = link.getAttribute('aria-current');
      const ariaSelected = link.getAttribute('aria-selected');
      const dataActive = link.getAttribute('data-active');
      if (ariaCurrent === 'true' || ariaCurrent === 'page' ||
          ariaSelected === 'true' || dataActive === 'true') {
        const label = link.getAttribute('aria-label') || '';
        const m = label.match(/Direct chat with\s+(.+)/i);
        if (m) return m[1].trim().toLowerCase();
      }
    }

    // Strategy 2: Visual active state — find the sidebar link with a different
    // background color than the majority (the "highlighted" one).
    // This is a rendered DOM property, not URL-dependent.
    if (chatLinks.length >= 2) {
      const bgCounts = {};
      const linkBgs = [];
      for (const link of chatLinks) {
        try {
          const bg = window.getComputedStyle(link).backgroundColor || '';
          linkBgs.push({ link, bg });
          bgCounts[bg] = (bgCounts[bg] || 0) + 1;
        } catch (e) { linkBgs.push({ link, bg: '' }); }
      }
      // Find the most common background (the "default" inactive color)
      let defaultBg = '';
      let maxCount = 0;
      for (const [bg, count] of Object.entries(bgCounts)) {
        if (count > maxCount) { defaultBg = bg; maxCount = count; }
      }
      // The active link is the ONE with a different background
      for (const { link, bg } of linkBgs) {
        if (bg && bg !== defaultBg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const label = link.getAttribute('aria-label') || '';
          const m = label.match(/Direct chat with\s+(.+)/i);
          if (m) return m[1].trim().toLowerCase();
        }
      }
    }

    // Strategy 3: Look for the conversation header in the message panel.
    // Reddit shows the partner's name prominently at the top of the chat.
    // This text only updates when the conversation actually renders.
    const headerSelectors = [
      'h1', 'h2', 'h3',
      '[data-testid*="conversation-header"]',
      '[class*="ConversationHeader"]',
      '[class*="conversation-header"]',
      '[class*="threadHeader"]',
    ];
    for (const sel of headerSelectors) {
      const headers = document.querySelectorAll(sel);
      for (const header of headers) {
        const text = (header.textContent || '').trim();
        if (text && looksLikeUsername(text) && !isCommonWord(text)) {
          // Cross-reference with sidebar to confirm it's a real chat partner
          const textLower = text.toLowerCase();
          for (const link of chatLinks) {
            const label = link.getAttribute('aria-label') || '';
            const m = label.match(/Direct chat with\s+(.+)/i);
            if (m && m[1].trim().toLowerCase() === textLower) {
              return textLower;
            }
          }
        }
      }
    }

    // Strategy 4: Look for user profile links in the message panel area.
    // The conversation partner's username often appears as a clickable profile link
    // (e.g., /user/USERNAME) near the top of the chat panel. Only trust if we find
    // exactly one unique user link that also appears in the sidebar (cross-reference).
    const messagePanelLinks = document.querySelectorAll('a[href*="/user/"]');
    const panelUsernames = new Set();
    for (const link of messagePanelLinks) {
      const m = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
      if (m && m[1] !== 'me' && !isCommonWord(m[1])) {
        const uLower = m[1].toLowerCase();
        // Cross-reference with sidebar
        for (const sideLink of chatLinks) {
          const sLabel = sideLink.getAttribute('aria-label') || '';
          const sm = sLabel.match(/Direct chat with\s+(.+)/i);
          if (sm && sm[1].trim().toLowerCase() === uLower) {
            panelUsernames.add(uLower);
          }
        }
      }
    }
    if (panelUsernames.size === 1) {
      return [...panelUsernames][0];
    }

    // NO URL-based fallback. If we can't determine the active conversation
    // from rendered DOM state, return null — scrape will be rejected.
    return null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_FETCH_TARGET') {
      const username = (message.username || '').toLowerCase();
      if (username) {
        _fetchTarget = { username, setAt: Date.now() };
        console.log('[SuperReddit] SET_FETCH_TARGET: ' + username);
      }
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'GET_SCAN_DATA') {
      console.log('[SuperReddit] GET_SCAN_DATA pull request — returning', latestScanData.usernames.length, 'usernames');
      sendResponse(latestScanData);
      return true;
    }
    if (message.type === 'IDENTIFY_OPEN_CHAT') {
      // Identify which conversation is currently displayed in the chat panel.
      // Uses the sidebar aria-label (exact Reddit username) + active/selected state.
      const partner = identifyOpenChatPartner();
      console.log('[SuperReddit] IDENTIFY_OPEN_CHAT: ' + (partner || 'unknown'));
      sendResponse({ username: partner });
      return true;
    }
    if (message.type === 'SCRAPE_OPEN_THREAD') {
      // Attempt to scrape messages from the currently visible chat thread DOM
      const threadMessages = scrapeVisibleThread();
      // Also identify the open chat partner so background can validate
      const partner = identifyOpenChatPartner();
      sendResponse({ messages: threadMessages, chatPartner: partner });
      return true;
    }
    if (message.type === 'PREFILL_CHAT_INPUT') {
      // Find the chat message input and fill it with the provided text.
      // Reddit chat UI may be inside shadow DOM, so we use deepQueryAll.
      var text = message.text || '';
      if (!text) { sendResponse({ filled: false }); return true; }

      function fillElement(el) {
        // Focus the element first
        el.focus();
        // Select all existing content (if any) then replace with our text
        // using execCommand which works with React-controlled inputs
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          el.select();
        } else {
          // contenteditable — select all
          var sel = window.getSelection();
          var range = document.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        // execCommand('insertText') fires proper InputEvent that React detects
        var inserted = document.execCommand('insertText', false, text);
        if (inserted) return true;
        // Fallback: native setter + synthetic events for older browsers
        if (el.tagName === 'TEXTAREA') {
          var nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
          nativeSetter.call(el, text);
        } else if (el.tagName === 'INPUT') {
          var inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          inputSetter.call(el, text);
        } else {
          el.textContent = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      // Returns the element that was filled, or null
      function tryFill() {
        // Strategy 1: textarea (current Reddit chat uses a textarea with placeholder "Message")
        var textareas = deepQueryAll('textarea');
        for (var j = 0; j < textareas.length; j++) {
          var ta = textareas[j];
          var ph = (ta.getAttribute('placeholder') || '').toLowerCase();
          if (ta.offsetHeight > 0 && (ph.indexOf('message') !== -1 || ph.indexOf('type') !== -1 || ph === '')) {
            if (fillElement(ta)) {
              console.log('[SuperReddit] PREFILL_CHAT_INPUT: filled textarea (placeholder="' + ta.getAttribute('placeholder') + '")');
              return ta;
            }
          }
        }

        // Strategy 2: contenteditable div (older Reddit chat UI)
        var editables = deepQueryAll('[contenteditable="true"]');
        for (var i = 0; i < editables.length; i++) {
          var el = editables[i];
          if (el.offsetHeight > 0 && el.offsetWidth > 0) {
            if (fillElement(el)) {
              console.log('[SuperReddit] PREFILL_CHAT_INPUT: filled contenteditable');
              return el;
            }
          }
        }

        // Strategy 3: input[type=text] with message-like placeholder
        var inputs = deepQueryAll('input[type="text"]');
        for (var k = 0; k < inputs.length; k++) {
          var inp = inputs[k];
          var inpPh = (inp.getAttribute('placeholder') || '').toLowerCase();
          if (inp.offsetHeight > 0 && (inpPh.indexOf('message') !== -1 || inpPh.indexOf('type') !== -1)) {
            if (fillElement(inp)) {
              console.log('[SuperReddit] PREFILL_CHAT_INPUT: filled input');
              return inp;
            }
          }
        }

        console.log('[SuperReddit] PREFILL_CHAT_INPUT: no input found (textareas=' + textareas.length + ', editables=' + editables.length + ', inputs=' + inputs.length + ')');
        return null;
      }

      // Watch a filled element — when it empties, the user sent the message, so auto-close popup
      function watchForSend(filledEl) {
        function getContent(el) {
          if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value;
          return el.textContent || '';
        }
        var originalLen = getContent(filledEl).length;
        if (originalLen === 0) return; // nothing to watch
        var checks = 0;
        var maxChecks = 120; // 60 seconds max
        var watchInterval = setInterval(function() {
          checks++;
          var current = getContent(filledEl).trim();
          if (current.length === 0 && checks > 2) {
            // Input cleared — message was sent
            clearInterval(watchInterval);
            console.log('[SuperReddit] Message sent detected — requesting popup close');
            // Small delay so the user sees the message appear in chat
            setTimeout(function() {
              chrome.runtime.sendMessage({ type: 'CLOSE_POPUP' });
            }, 1500);
          } else if (checks >= maxChecks) {
            clearInterval(watchInterval);
          }
        }, 500);
      }

      // Try immediately, then retry a few times (SPA input may not be rendered yet)
      var filledEl = tryFill();
      if (filledEl) {
        watchForSend(filledEl);
        sendResponse({ filled: true });
      } else {
        var attempts = 0;
        var retryInterval = setInterval(function() {
          attempts++;
          var el = tryFill();
          if (el || attempts >= 10) {
            clearInterval(retryInterval);
            if (el) watchForSend(el);
            sendResponse({ filled: !!el });
          }
        }, 500);
      }
      return true;
    }
    if (message.type === 'NAVIGATE_TO_CHAT') {
      // Background is asking us to click a specific conversation in the sidebar
      const targetUser = (message.username || '').toLowerCase();
      if (!targetUser) {
        sendResponse({ triggered: false, reason: 'no_username' });
        return true;
      }

      console.log('[SuperReddit] NAVIGATE_TO_CHAT: looking for u/' + targetUser);

      // Helper: search currently visible sidebar links for the target user
      function tryClickUser() {
        const chatLinks = deepQueryAll('a[aria-label*="Direct chat with"]');
        for (const link of chatLinks) {
          const label = link.getAttribute('aria-label') || '';
          const m = label.match(/Direct chat with\s+(.+)/i);
          if (m && m[1].trim().toLowerCase() === targetUser) {
            link.click();
            return true;
          }
        }
        return false;
      }

      // Try immediate click (user might be visible already)
      if (tryClickUser()) {
        console.log('[SuperReddit] NAVIGATE_TO_CHAT: found and clicked u/' + targetUser);
        sendResponse({ triggered: true });
        return true;
      }

      // User not visible — scroll the sidebar to find them (virtual scroll hides most items)
      console.log('[SuperReddit] NAVIGATE_TO_CHAT: user not in viewport, scrolling sidebar...');
      const scrollables = findAllScrollable();
      const sidebar = scrollables
        .filter(function (sc) { return sc.clientWidth > 100 && sc.clientWidth < 500 && sc.scrollHeight > sc.clientHeight + 10; })
        .sort(function (a, b) { return b.scrollHeight - a.scrollHeight; })[0];

      if (!sidebar) {
        console.log('[SuperReddit] NAVIGATE_TO_CHAT: no scrollable sidebar found');
        sendResponse({ triggered: false, reason: 'no_scrollable_sidebar' });
        return true;
      }

      // Scroll through the sidebar looking for the user
      let scrollRound = 0;
      const MAX_SCROLL = 40;
      const startScrollTop = sidebar.scrollTop;

      const scrollSearch = setInterval(function () {
        scrollRound++;
        const prevTop = sidebar.scrollTop;
        sidebar.scrollTop += Math.max(sidebar.clientHeight * 0.7, 300);
        sidebar.dispatchEvent(new Event('scroll', { bubbles: true }));

        // Check if the user appeared after this scroll
        if (tryClickUser()) {
          clearInterval(scrollSearch);
          console.log('[SuperReddit] NAVIGATE_TO_CHAT: found u/' + targetUser + ' after ' + scrollRound + ' scroll rounds');
          sendResponse({ triggered: true });
          return;
        }

        const didScroll = sidebar.scrollTop > prevTop + 5;
        if (!didScroll || scrollRound >= MAX_SCROLL) {
          clearInterval(scrollSearch);
          sidebar.scrollTop = startScrollTop; // restore scroll position
          console.log('[SuperReddit] NAVIGATE_TO_CHAT: u/' + targetUser + ' not found after ' + scrollRound + ' scroll rounds');
          sendResponse({ triggered: false, reason: 'not_found_after_scroll', rounds: scrollRound });
        }
      }, 400);

      return true; // keep message channel open for async response
    }
  });

  // ---- DOM Thread Scraper ----
  // Scrapes messages from the currently open chat conversation panel.
  // This complements the API interceptor — captures what's visible in the DOM.

  function scrapeVisibleThread() {
    const messages = [];
    const me = getLoggedInUsername();

    console.log('[SuperReddit] DOM scraper: starting on ' + location.pathname);

    // Find the message thread container — it's typically the wider panel (not the sidebar)
    // Reddit renders messages as individual elements within a scrollable container
    const allScrollable = findAllScrollable().filter(function (el) {
      return el.clientWidth > 400; // wider than sidebar
    });

    if (allScrollable.length === 0) {
      console.log('[SuperReddit] DOM scraper: no wide scrollable containers found');
      return messages;
    }

    var threadContainer = allScrollable[0];
    console.log('[SuperReddit] DOM scraper: container=' + threadContainer.tagName +
      ' w=' + threadContainer.clientWidth + ' h=' + threadContainer.clientHeight +
      ' children=' + threadContainer.children.length);

    // Strategy 1: Reddit chat-specific selectors
    var msgEls = threadContainer.querySelectorAll(
      '[class*="message"], [class*="Message"], [data-testid*="message"], ' +
      'rs-message, [class*="chat-message"], [class*="ChatMessage"], ' +
      '[data-testid*="chat"], [class*="event-body"], [class*="EventBody"]'
    );
    console.log('[SuperReddit] DOM scraper: strategy 1 (selectors) found ' + msgEls.length + ' elements');

    // Strategy 2: Look deeper — check shadow DOM too
    if (msgEls.length === 0) {
      msgEls = deepQueryAll(
        '[class*="message"], [class*="Message"], rs-message, [class*="chat-message"]',
        threadContainer
      );
      console.log('[SuperReddit] DOM scraper: strategy 2 (deep query) found ' + msgEls.length + ' elements');
    }

    // Strategy 3: If no class-based matches, look for repeating child structures
    if (msgEls.length === 0) {
      var children = threadContainer.children;
      var textChildren = 0;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        var text = (child.textContent || '').trim();
        if (text.length > 0 && text.length < 2000) textChildren++;
      }
      if (textChildren > 0) {
        msgEls = threadContainer.children;
        console.log('[SuperReddit] DOM scraper: strategy 3 (children) using ' + msgEls.length + ' children (' + textChildren + ' with text)');
      }
    }

    // Aggressive garbage filter — reject anything that looks like page chrome or JS
    function isGarbage(text) {
      // JS code patterns
      if (/^(window\.|if\(|var |let |const |function |import |export |@font-face|@media|@keyframes)/i.test(text)) return true;
      if (/\b(window\.__servedBy|document\.(hidden|get|query)|chrome-extension:\/\/|createElement|addEventListener|innerHTML)\b/.test(text)) return true;
      if (text.indexOf('{') !== -1 && text.indexOf('}') !== -1 && (text.indexOf('function') !== -1 || text.indexOf('=>') !== -1)) return true;
      // Page chrome / navigation text
      if (/^(Skip to |Page not found|Explore Reddit|<!DOCTYPE|Loading\.\.\.|Reddit - |Log In|Sign Up)/i.test(text)) return true;
      // CSS or HTML
      if (/^(\.|#|@)\{/.test(text) || /<(div|span|script|style|html|head|body)\b/i.test(text)) return true;
      // Very long strings with no spaces are likely encoded/minified content
      if (text.length > 200 && text.split(' ').length < 5) return true;
      // URLs that aren't message content
      if (/^https?:\/\/[^\s]+$/.test(text) && text.length > 100) return true;
      return false;
    }

    // Track last seen author — Reddit Chat groups consecutive messages from the
    // same sender; only the first message in a group has a username label.
    var lastAuthor = '';
    var lastIsFromYou = false;

    for (var j = 0; j < msgEls.length; j++) {
      var el = msgEls[j];
      var text = (el.textContent || '').trim();
      if (!text || text.length < 1 || text.length > 5000) continue;

      // Apply garbage filter
      if (isGarbage(text)) continue;

      // Try to determine sender from DOM hints
      var isFromYou = false;
      var authorName = '';

      // Check for "You" indicator or username mentions
      var spans = el.querySelectorAll('span, strong, b');
      for (var k = 0; k < spans.length; k++) {
        var spanText = (spans[k].textContent || '').trim();
        if (spanText === 'You' || spanText === 'you') {
          isFromYou = true;
          break;
        }
        if (looksLikeUsername(spanText) && !isCommonWord(spanText)) {
          authorName = spanText.toLowerCase();
        }
      }

      // If we know our username, check if author matches
      if (me && authorName === me) isFromYou = true;
      if (me && authorName && authorName !== me) isFromYou = false;

      // If no author found on this element, inherit from previous message
      // (Reddit Chat continuation messages don't repeat the username)
      if (!authorName && !isFromYou) {
        authorName = lastAuthor;
        isFromYou = lastIsFromYou;
      }

      // Update last known author for continuation detection
      if (authorName) {
        lastAuthor = authorName;
        lastIsFromYou = isFromYou;
      }

      // Clean text — remove author name prefix if present
      var cleanText = text;
      if (authorName) {
        cleanText = cleanText.replace(new RegExp('^' + authorName + '[:\\s]+', 'i'), '').trim();
      }
      cleanText = cleanText.replace(/^You[:\s]+/i, '').trim();

      if (cleanText.length > 0) {
        messages.push({
          id: 'dom_' + j,
          text: cleanText,
          author: isFromYou ? (me || 'you') : (authorName || 'them'),
          isFromYou: isFromYou,
          timestamp: 0, // DOM doesn't reliably give timestamps
        });
      }
    }

    console.log('[SuperReddit] DOM scraper: extracted ' + messages.length + ' messages');
    if (messages.length > 0 && messages.length <= 5) {
      // Log first few messages for debugging
      for (var m = 0; m < messages.length; m++) {
        console.log('[SuperReddit] DOM msg[' + m + ']: ' + messages[m].author + ': ' + messages[m].text.substring(0, 80));
      }
    }

    return messages;
  }

  // ---- Compose Page Auto-Send ----

  function isOnComposePage() {
    return location.pathname.includes('/message/compose');
  }

  function handleComposePage() {
    console.log('[SuperReddit] Compose page detected — waiting for form to load');

    // Extract username from URL for reporting
    const urlParams = new URLSearchParams(location.search);
    const toUsername = urlParams.get('to') || '';

    let attempts = 0;
    const MAX_ATTEMPTS = 20; // 20 × 500ms = 10s max wait for form

    const formWaiter = setInterval(() => {
      attempts++;

      // Look for the send/submit button
      const sendBtn = findSendButton();
      if (!sendBtn) {
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(formWaiter);
          console.log('[SuperReddit] Compose: could not find Send button after ' + MAX_ATTEMPTS + ' attempts');
          reportComposeResult(false, 'Could not find Send button on compose page', toUsername);
        }
        return;
      }

      clearInterval(formWaiter);

      // Verify pre-filled fields are present
      const toField = document.querySelector('input[name="to"]') || document.querySelector('#to');
      const subjectField = document.querySelector('input[name="subject"]') || document.querySelector('#subject');
      const messageField = document.querySelector('textarea[name="message"]') || document.querySelector('#message') || document.querySelector('textarea[name="text"]') || document.querySelector('#text');

      console.log('[SuperReddit] Compose form found — to:', toField?.value, 'subject:', subjectField?.value?.substring(0, 30), 'body length:', messageField?.value?.length);

      // Check for obvious errors before clicking
      const preError = detectComposeError();
      if (preError) {
        console.log('[SuperReddit] Compose: pre-send error detected:', preError);
        reportComposeResult(false, preError, toUsername);
        return;
      }

      // Click send
      console.log('[SuperReddit] Compose: clicking Send button');
      sendBtn.click();

      // Poll for success/failure after clicking send
      detectSendOutcome(toUsername);
    }, 500);
  }

  function findSendButton() {
    // Strategy 1: submit button with "send" text
    const buttons = document.querySelectorAll('button[type="submit"], button, input[type="submit"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      if (text === 'send' || text === 'send message') return btn;
    }

    // Strategy 2: .c-btn-primary or .btn (Reddit's old design)
    const primary = document.querySelector('.c-btn-primary, .btn[type="submit"], .submit button');
    if (primary) return primary;

    // Strategy 3: any submit button
    const anySubmit = document.querySelector('button[type="submit"], input[type="submit"]');
    if (anySubmit) return anySubmit;

    return null;
  }

  function detectComposeError() {
    // Check for error elements
    const errorEls = document.querySelectorAll('.error, .c-form-error, [class*="error"]');
    for (const el of errorEls) {
      const text = (el.textContent || '').trim();
      if (text.length > 0 && text.length < 200) {
        // Filter out generic class-name matches that aren't actual errors
        if (el.offsetHeight > 0 && el.offsetWidth > 0) return text;
      }
    }

    // Check for captcha
    const captcha = document.querySelector('.g-recaptcha, [class*="captcha"], iframe[src*="captcha"]');
    if (captcha) return 'Captcha required — please send this DM manually';

    // Check for rate limit messages in page body
    const bodyText = document.body?.textContent || '';
    if (/you are doing that too much/i.test(bodyText)) {
      const match = bodyText.match(/try again in (\d+ \w+)/i);
      return 'Reddit rate limit: ' + (match ? 'try again in ' + match[1] : 'you are doing that too much');
    }

    return null;
  }

  function detectSendOutcome(username) {
    let checks = 0;
    const MAX_CHECKS = 20; // 20 × 500ms = 10s

    const checker = setInterval(() => {
      checks++;

      // Check for success: Reddit redirects or shows success message after sending
      // Old Reddit redirects to /message/sent or shows a success banner
      if (location.pathname.includes('/message/sent') || location.pathname.includes('/message/compose') === false) {
        clearInterval(checker);
        console.log('[SuperReddit] Compose: send success (page redirected)');
        reportComposeResult(true, null, username);
        return;
      }

      // Check for success message on page
      const successEls = document.querySelectorAll('.success, [class*="success"], .infobar');
      for (const el of successEls) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('your message has been delivered') || text.includes('message sent')) {
          clearInterval(checker);
          console.log('[SuperReddit] Compose: send success (success message found)');
          reportComposeResult(true, null, username);
          return;
        }
      }

      // Check for errors that appeared after clicking send
      const error = detectComposeError();
      if (error && checks > 2) { // Wait at least 2 checks before reporting error (to skip transient states)
        clearInterval(checker);
        console.log('[SuperReddit] Compose: send failed —', error);
        reportComposeResult(false, error, username);
        return;
      }

      if (checks >= MAX_CHECKS) {
        clearInterval(checker);
        // If we're still on the compose page with no error, it might have worked (some Reddit versions don't redirect)
        const finalError = detectComposeError();
        if (finalError) {
          console.log('[SuperReddit] Compose: timed out with error —', finalError);
          reportComposeResult(false, finalError, username);
        } else {
          // Assume success if no error after 10s — Reddit sometimes doesn't show clear confirmation
          console.log('[SuperReddit] Compose: timed out with no error — assuming success');
          reportComposeResult(true, null, username);
        }
      }
    }, 500);
  }

  function reportComposeResult(success, error, username) {
    try {
      chrome.runtime.sendMessage(
        { type: 'COMPOSE_RESULT', success, error, username },
        () => { if (chrome.runtime.lastError) { /* ignore */ } }
      );
    } catch (e) {
      console.log('[SuperReddit] Failed to report compose result:', e.message);
    }
  }

  // ---- Chat API Interception Handler ----
  // Listens for passively intercepted API responses from the MAIN world script.
  // Extracts conversation messages and forwards them to background for storage.

  let loggedInUsername = null; // cached after first detection

  function getLoggedInUsername() {
    if (loggedInUsername) return loggedInUsername;
    // Strategy 1: Profile link in header/nav
    const profileLinks = document.querySelectorAll('a[href*="/user/"]');
    for (const link of profileLinks) {
      const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('profile') || ariaLabel.includes('avatar') || ariaLabel.includes('account')) {
        const match = link.href.match(/\/user\/([A-Za-z0-9_-]{3,20})/);
        if (match && match[1] !== 'me') {
          loggedInUsername = match[1].toLowerCase();
          return loggedInUsername;
        }
      }
    }
    // Strategy 2: Reddit config data in page
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      const match = text.match(/"username"\s*:\s*"([A-Za-z0-9_-]{3,20})"/);
      if (match) {
        loggedInUsername = match[1].toLowerCase();
        return loggedInUsername;
      }
    }
    return null;
  }

  // Generic message extractor — tries known Reddit API patterns
  function extractMessagesFromResponse(data) {
    const messages = [];
    const seen = new Set();

    function addMsg(msg) {
      if (!msg || !msg.text) return;
      const key = msg.id || (msg.author + ':' + msg.text.substring(0, 50) + ':' + msg.timestamp);
      if (seen.has(key)) return;
      seen.add(key);
      messages.push(msg);
    }

    function tryExtract(obj) {
      if (!obj || typeof obj !== 'object') return null;
      // Must have text
      const text = obj.message || obj.text || obj.body ||
                   (obj.content && (obj.content.text || obj.content.body)) ||
                   obj.richtext || obj.plainText || obj.messageBody;
      if (!text || typeof text !== 'string' || text.length === 0) return null;
      // Must have author — handle both object and string patterns
      var author = null;
      // Object patterns (SendBird, generic APIs)
      if (!author && obj.user && typeof obj.user === 'object') {
        author = obj.user.nickname || obj.user.name || obj.user.username || obj.user.displayName || null;
      }
      if (!author && obj.author && typeof obj.author === 'object') {
        author = obj.author.name || obj.author.username || obj.author.displayName || null;
      }
      if (!author && obj.sender && typeof obj.sender === 'object') {
        author = obj.sender.name || obj.sender.username || obj.sender.displayName || null;
      }
      // String patterns — Matrix "@user:reddit.com" or plain username
      if (!author && typeof obj.sender === 'string' && obj.sender.length > 0) {
        author = obj.sender.replace(/^@/, '').replace(/:.*$/, '');
      }
      if (!author && typeof obj.author === 'string' && obj.author.length > 0 && obj.author.length < 50) {
        author = obj.author;
      }
      // ID fallbacks
      if (!author) {
        author = obj.user_id || obj.authorId || obj.senderId || obj.authorName || null;
      }
      if (!author) return null;
      const ts = obj.created_at || obj.createdAt || obj.timestamp || obj.ts || obj.sentAt || 0;
      const id = obj.message_id || obj.id || obj.messageId || '';
      return {
        id: String(id),
        text: String(text),
        author: String(author).replace(/^t2_/i, '').toLowerCase(),
        timestamp: typeof ts === 'number' ? ts : (new Date(ts).getTime() || 0),
      };
    }

    function walk(obj, depth) {
      if (depth > 12 || !obj) return;
      if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
          var msg = tryExtract(obj[i]);
          if (msg) addMsg(msg);
          else walk(obj[i], depth + 1);
        }
      } else if (typeof obj === 'object') {
        // GraphQL edges pattern
        if (obj.edges && Array.isArray(obj.edges)) {
          for (var j = 0; j < obj.edges.length; j++) {
            var edge = obj.edges[j];
            if (edge && edge.node) {
              var m = tryExtract(edge.node);
              if (m) addMsg(m);
              else walk(edge.node, depth + 1);
            }
          }
        }
        // Direct arrays
        for (var key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          walk(obj[key], depth + 1);
        }
      }
    }

    walk(data, 0);
    return messages;
  }

  // Determine which conversation partner the messages belong to
  function identifyConversationUser(messages) {
    if (messages.length === 0) return null;
    var me = getLoggedInUsername();
    var authors = {};
    for (var i = 0; i < messages.length; i++) {
      var a = messages[i].author;
      if (a) authors[a] = (authors[a] || 0) + 1;
    }
    var authorList = Object.keys(authors);
    // 1-on-1 chat: 2 participants, one is "me"
    if (authorList.length === 2 && me) {
      var other = authorList[0] === me ? authorList[1] : authorList[0];
      return other;
    }
    // If we don't know who "me" is, pick the author matching a known conversation
    if (authorList.length === 2) {
      // Check which author is in our known conversations list from sidebar scanning
      for (var j = 0; j < authorList.length; j++) {
        if (latestScanData.usernames.indexOf(authorList[j]) !== -1) {
          return authorList[j];
        }
      }
    }
    // Single author — might be all from one person (the other user)
    if (authorList.length === 1 && me && authorList[0] !== me) {
      return authorList[0];
    }
    return null;
  }

  // Tag messages with isFromYou
  function tagMessages(messages, conversationUser) {
    var me = getLoggedInUsername();
    return messages.map(function (msg) {
      var isFromYou = false;
      if (me) {
        isFromYou = msg.author === me;
      } else {
        isFromYou = msg.author !== conversationUser;
      }
      return {
        id: msg.id,
        text: msg.text,
        author: msg.author,
        isFromYou: isFromYou,
        timestamp: msg.timestamp,
      };
    });
  }

  // Listen for intercepted API responses from MAIN world
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== '__SR_CHAT_INTERCEPT__') return;

    // WebSocket fast-path: messages already structured by chat-interceptor.js
    if (event.data.websocket === true) {
      var wsMessages = event.data.messages || [];
      if (wsMessages.length === 0) return;

      var conversationUser = identifyConversationUser(wsMessages);
      if (!conversationUser) {
        // Fallback: use fetch target hint if available and messages are 1:1
        var uniqueAuthors = {};
        for (var wa = 0; wa < wsMessages.length; wa++) {
          if (wsMessages[wa].author) uniqueAuthors[wsMessages[wa].author] = true;
        }
        var authorCount = Object.keys(uniqueAuthors).length;
        var target = (authorCount >= 1 && authorCount <= 2) ? getActiveFetchTarget() : null;
        if (target) {
          conversationUser = target;
          console.log('[SuperReddit] WS: used fetch target hint "' + target + '" for ' + wsMessages.length + ' messages (authors: ' + Object.keys(uniqueAuthors).join(', ') + ')');
        } else {
          console.log('[SuperReddit] WS: intercepted ' + wsMessages.length + ' messages but could not identify conversation partner (authors: ' + Object.keys(uniqueAuthors).join(', ') + ')');
          return;
        }
      }

      var tagged = tagMessages(wsMessages, conversationUser);
      console.log('[SuperReddit] WS: intercepted ' + tagged.length + ' messages for u/' + conversationUser);

      // Capture chatUrl from current page URL (e.g. /chat/room/ROOM_ID)
      captureChatUrlFromLocation(conversationUser);

      try {
        chrome.runtime.sendMessage({
          type: 'STORE_CONVERSATION_MESSAGES',
          username: conversationUser,
          messages: tagged,
          source: 'websocket',
        }, function () { if (chrome.runtime.lastError) { /* ignore */ } });
      } catch (e) { /* orphaned context */ }
      return;
    }

    // Standard fetch/XHR intercept path
    var url = event.data.url || '';
    var data = event.data.data;
    var opName = event.data.operationName;

    // Diagnostic logging for chat-related API responses
    var isChatApi = url.indexOf('gql.reddit.com') !== -1 ||
                    url.indexOf('/svc/shreddit/graphql') !== -1 ||
                    url.indexOf('/svc/matrix-web/') !== -1 ||
                    url.indexOf('/api/chat/') !== -1;
    if (isChatApi && data) {
      var topKeys = data.data ? Object.keys(data.data) : Object.keys(data);
      console.log('[SuperReddit] API intercept: op=' + (opName || '?') + ' url=' + url.substring(0, 80) + ' topKeys=' + topKeys.join(','));
      // Deep preview of the response to identify message format
      try {
        var preview = JSON.stringify(data).substring(0, 1200);
        console.log('[SuperReddit] API data preview (' + (opName || '?') + '): ' + preview);
      } catch (e) { /* circular ref or too large */ }
    }

    var messages = extractMessagesFromResponse(data);

    // Log when a chat API yields 0 messages — helps diagnose extraction issues
    if (messages.length === 0 && isChatApi) {
      console.log('[SuperReddit] API intercept: 0 messages from op=' + (opName || '?') + ' url=' + url.substring(0, 80));
    }
    if (messages.length === 0) return;

    var conversationUser = identifyConversationUser(messages);
    if (!conversationUser) {
      // Fallback: use fetch target hint if available
      var apiUniqueAuthors = {};
      for (var aa = 0; aa < messages.length; aa++) {
        if (messages[aa].author) apiUniqueAuthors[messages[aa].author] = true;
      }
      var apiAuthorCount = Object.keys(apiUniqueAuthors).length;
      var apiTarget = (apiAuthorCount >= 1 && apiAuthorCount <= 2) ? getActiveFetchTarget() : null;
      if (apiTarget) {
        conversationUser = apiTarget;
        console.log('[SuperReddit] API: used fetch target hint "' + apiTarget + '" for ' + messages.length + ' messages');
      } else {
        console.log('[SuperReddit] Intercepted ' + messages.length + ' messages but could not identify conversation partner');
        return;
      }
    }

    var tagged = tagMessages(messages, conversationUser);
    console.log('[SuperReddit] Intercepted ' + tagged.length + ' messages for u/' + conversationUser);

    // Capture chatUrl from current page URL
    captureChatUrlFromLocation(conversationUser);

    try {
      chrome.runtime.sendMessage({
        type: 'STORE_CONVERSATION_MESSAGES',
        username: conversationUser,
        messages: tagged,
        source: 'api_intercept',
      }, function () { if (chrome.runtime.lastError) { /* ignore */ } });
    } catch (e) { /* orphaned context */ }
  });

  // ---- Chat URL capture from page location ----
  // When viewing a conversation, map the username to the current /chat/room/... URL
  function captureChatUrlFromLocation(username) {
    try {
      var path = location.pathname;
      if (path.indexOf('/chat/') !== -1 && username) {
        var userLower = username.toLowerCase();
        console.log('[SuperReddit] Mapping u/' + userLower + ' → ' + path);
        chrome.storage.local.get(CHAT_URLS_KEY, function (result) {
          if (chrome.runtime.lastError) return;
          var existing = result[CHAT_URLS_KEY] || {};
          if (existing[userLower] !== path) {
            existing[userLower] = path;
            chrome.storage.local.set({ [CHAT_URLS_KEY]: existing });
            chrome.runtime.sendMessage(
              { type: 'STORE_CHAT_URLS', chatUrls: existing },
              function () { if (chrome.runtime.lastError) { /* ignore */ } }
            );
          }
        });
      }
    } catch (e) { /* ignore */ }
  }

  // ---- Submit Page Auto-Fill ----

  function isOnSubmitPage() {
    return location.pathname.includes('/submit');
  }

  function handleSubmitPage() {
    chrome.storage.local.get('sr_pending_post', function (result) {
      var pending = result.sr_pending_post;
      if (!pending || (Date.now() - pending.timestamp) > 300000) return; // 5 min expiry

      // Clear immediately to prevent re-processing on page reload
      chrome.storage.local.remove('sr_pending_post');
      console.log('[SuperReddit] Submit page: filling post — title:', pending.title.substring(0, 40), '| body length:', pending.body.length, '| images:', (pending.images || []).length);

      fillSubmitForm(pending);
    });
  }

  function fillSubmitForm(postData) {
    var attempts = 0;
    var MAX_ATTEMPTS = 40; // 40 × 500ms = 20s

    var formFiller = setInterval(function () {
      attempts++;

      // Find the title input — try multiple strategies
      var titleInput = findTitleInput();

      if (!titleInput) {
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(formFiller);
          console.log('[SuperReddit] Submit: could not find title input after ' + MAX_ATTEMPTS + ' attempts');
        }
        return;
      }

      clearInterval(formFiller);
      console.log('[SuperReddit] Submit: found title input, filling form');

      // Fill title
      setNativeValue(titleInput, postData.title);

      var hasImages = postData.images && postData.images.length > 0;

      if (hasImages) {
        // Upload images FIRST in rich text mode, then fill body in rich text mode
        // (can't switch to markdown — it would delete the uploaded images)
        setTimeout(function () {
          uploadPostImages(postData.images, function () {
            setTimeout(function () {
              fillBodyRichText(postData.body);
            }, 500);
          });
        }, 800);
      } else {
        // No images — switch to markdown for perfect formatting
        setTimeout(function () {
          switchToMarkdownAndFill(postData);
        }, 800);
      }
    }, 500);
  }

  function findTitleInput() {
    // Strategy 1: Shreddit post composer (newest Reddit)
    var shredditPost = document.querySelector('shreddit-post-composer, shreddit-composer');
    if (shredditPost) {
      // Try inside shadow DOM
      var sr = shredditPost.shadowRoot;
      if (sr) {
        var titleArea = sr.querySelector('textarea[name="title"], textarea[placeholder*="title" i], input[name="title"]');
        if (titleArea) return titleArea;
      }
    }

    // Strategy 2: Direct selectors for various Reddit versions
    var selectors = [
      'textarea[name="title"]',
      'input[name="title"]',
      'textarea[placeholder*="title" i]',
      'input[placeholder*="title" i]',
      '#title-field textarea',
      '#title-field input',
      '[data-testid="post-title"] textarea',
      '[data-testid="post-title"] input',
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }

    // Strategy 3: Deep query through shadow DOMs
    var deepTextareas = deepQueryAll('textarea[name="title"], textarea[placeholder*="title" i]');
    if (deepTextareas.length > 0) return deepTextareas[0];

    return null;
  }

  function setNativeValue(el, value) {
    // Use native setter to bypass React's controlled input
    var proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');

    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillBodyRichText(bodyText) {
    if (!bodyText) return;

    // Find the rich text editor
    var editorSelectors = [
      '[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"][data-lexical-editor]',
      '.ql-editor',
      'div[contenteditable="true"]',
    ];

    var editor = null;
    for (var i = 0; i < editorSelectors.length; i++) {
      var el = document.querySelector(editorSelectors[i]);
      if (el && el.offsetHeight > 30) {
        editor = el;
        break;
      }
    }

    if (!editor) {
      var deep = deepQueryAll('div[contenteditable="true"], [role="textbox"]');
      for (var d = 0; d < deep.length; d++) {
        if (deep[d].offsetHeight > 30) {
          editor = deep[d];
          break;
        }
      }
    }

    if (!editor) {
      console.log('[SuperReddit] Submit: could not find rich text editor for body');
      return;
    }

    console.log('[SuperReddit] Submit: filling body in rich text mode with paragraph simulation');
    editor.focus();

    // Clear any existing content
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    // Split into paragraphs on double newlines and insert with Enter key presses
    var paragraphs = bodyText.split(/\n\n+/);
    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p];
      // Handle single newlines within a paragraph as line breaks
      var lines = para.split('\n');
      for (var l = 0; l < lines.length; l++) {
        document.execCommand('insertText', false, lines[l]);
        if (l < lines.length - 1) {
          // Shift+Enter for line break within paragraph
          editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, shiftKey: true, bubbles: true }));
          document.execCommand('insertLineBreak', false, null);
        }
      }
      if (p < paragraphs.length - 1) {
        // Enter for new paragraph — dispatch keydown then use insertParagraph
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        document.execCommand('insertParagraph', false, null);
      }
    }

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('[SuperReddit] Submit: rich text body filled with ' + paragraphs.length + ' paragraphs');
  }

  function switchToMarkdownAndFill(postData) {
    // Find the "Switch to Markdown" button
    var allClickables = document.querySelectorAll('button, a, [role="button"], span[class*="markdown" i]');
    var mdButton = null;
    for (var i = 0; i < allClickables.length; i++) {
      var text = (allClickables[i].textContent || '').trim().toLowerCase();
      if (text === 'switch to markdown' || text === 'markdown' || text === 'markdown mode') {
        mdButton = allClickables[i];
        break;
      }
    }

    if (!mdButton) {
      var deep = deepQueryAll('button, [role="button"]');
      for (var j = 0; j < deep.length; j++) {
        var dt = (deep[j].textContent || '').trim().toLowerCase();
        if (dt === 'switch to markdown' || dt === 'markdown' || dt === 'markdown mode') {
          mdButton = deep[j];
          break;
        }
      }
    }

    if (mdButton) {
      console.log('[SuperReddit] Submit: clicking "Switch to Markdown"');
      mdButton.click();
    }

    // Poll for the markdown body textarea to appear (whether we clicked or not)
    var bodyAttempts = 0;
    var bodyPoller = setInterval(function () {
      bodyAttempts++;

      // Accept any confirmation dialog that may appear
      if (bodyAttempts <= 3) {
        var confirmBtns = document.querySelectorAll('button');
        for (var k = 0; k < confirmBtns.length; k++) {
          var ct = (confirmBtns[k].textContent || '').trim().toLowerCase();
          if (ct === 'continue' || ct === 'yes' || ct === 'ok' || ct === 'switch') {
            console.log('[SuperReddit] Submit: confirming markdown switch');
            confirmBtns[k].click();
            break;
          }
        }
      }

      // Look for a body textarea (not the title one)
      var textareas = document.querySelectorAll('textarea');
      var bodyTextarea = null;
      for (var t = 0; t < textareas.length; t++) {
        var ta = textareas[t];
        var name = (ta.name || '').toLowerCase();
        var placeholder = (ta.placeholder || '').toLowerCase();
        if (name === 'title' || placeholder.includes('title')) continue;
        if (ta.offsetHeight > 0) {
          bodyTextarea = ta;
          break;
        }
      }

      if (!bodyTextarea) {
        // Also try deep query
        var deepTas = deepQueryAll('textarea');
        for (var d = 0; d < deepTas.length; d++) {
          var dta = deepTas[d];
          var dn = (dta.name || '').toLowerCase();
          var dp = (dta.placeholder || '').toLowerCase();
          if (dn === 'title' || dp.includes('title')) continue;
          if (dta.offsetHeight > 0) {
            bodyTextarea = dta;
            break;
          }
        }
      }

      if (bodyTextarea) {
        clearInterval(bodyPoller);
        console.log('[SuperReddit] Submit: found body textarea, filling text');
        setNativeValue(bodyTextarea, postData.body);
        return;
      }

      if (bodyAttempts >= 30) { // 30 × 300ms = 9s
        clearInterval(bodyPoller);
        console.log('[SuperReddit] Submit: could not find body textarea after markdown switch');
        // Last resort — try the rich text editor approach
        fillPostBody(postData.body);
      }
    }, 300);
  }

  function insertParagraphs(editor, text) {
    // Split on double newlines (paragraph breaks) — preserves the same paragraph
    // structure as in our app's textarea
    var paragraphs = text.split(/\n\n+/);
    for (var i = 0; i < paragraphs.length; i++) {
      var para = paragraphs[i];
      // Within a paragraph, handle single newlines as line breaks
      var lines = para.split('\n');
      for (var l = 0; l < lines.length; l++) {
        document.execCommand('insertText', false, lines[l]);
        if (l < lines.length - 1) {
          // Single newline → Shift+Enter (line break within paragraph)
          document.execCommand('insertLineBreak', false, null);
        }
      }
      if (i < paragraphs.length - 1) {
        // Double newline → Enter twice (new paragraph)
        document.execCommand('insertParagraph', false, null);
        document.execCommand('insertParagraph', false, null);
      }
    }
  }

  function fillPostBody(bodyText) {
    if (!bodyText) return;

    // Strategy 1: Markdown mode textarea (look for non-title textareas)
    var textareas = document.querySelectorAll('textarea');
    var bodyTextarea = null;
    for (var i = 0; i < textareas.length; i++) {
      var ta = textareas[i];
      var name = (ta.name || '').toLowerCase();
      var placeholder = (ta.placeholder || '').toLowerCase();
      // Skip title fields
      if (name === 'title' || placeholder.includes('title')) continue;
      // Body is typically taller
      if (ta.offsetHeight > 40 || name === 'body' || name === 'text' || placeholder.includes('text') || placeholder.includes('body') || placeholder.includes('optional')) {
        bodyTextarea = ta;
        break;
      }
    }

    if (bodyTextarea) {
      console.log('[SuperReddit] Submit: filling body via textarea');
      setNativeValue(bodyTextarea, bodyText);
      return;
    }

    // Strategy 2: Contenteditable rich text editor
    var editableSelectors = [
      '.ql-editor',
      '[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"][data-lexical-editor]',
      'div[contenteditable="true"]',
    ];

    for (var j = 0; j < editableSelectors.length; j++) {
      var editor = document.querySelector(editableSelectors[j]);
      if (editor && editor.offsetHeight > 30) {
        console.log('[SuperReddit] Submit: filling body via contenteditable (' + editableSelectors[j] + ')');
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        // Insert paragraph by paragraph to preserve line breaks
        insertParagraphs(editor, bodyText);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }

    // Strategy 3: Deep query through shadow DOMs
    var deepEditables = deepQueryAll('textarea, div[contenteditable="true"]');
    for (var k = 0; k < deepEditables.length; k++) {
      var el = deepEditables[k];
      var elName = (el.name || '').toLowerCase();
      if (elName === 'title' || (el.placeholder || '').toLowerCase().includes('title')) continue;
      if (el.tagName === 'TEXTAREA') {
        console.log('[SuperReddit] Submit: filling body via deep textarea');
        setNativeValue(el, bodyText);
        return;
      }
      if (el.contentEditable === 'true' && el.offsetHeight > 30) {
        console.log('[SuperReddit] Submit: filling body via deep contenteditable');
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        insertParagraphs(el, bodyText);
        return;
      }
    }

    console.log('[SuperReddit] Submit: could not find body field');
  }

  function uploadPostImages(images, callback) {
    // First, try to switch to image/video tab if available
    var tabButtons = document.querySelectorAll('button, [role="tab"]');
    var clickedTab = false;
    for (var t = 0; t < tabButtons.length; t++) {
      var text = (tabButtons[t].textContent || '').toLowerCase().trim();
      if (text === 'images & video' || text === 'image' || text === 'image & video' || text === 'images' || text === 'media') {
        console.log('[SuperReddit] Submit: clicking image tab "' + text + '"');
        tabButtons[t].click();
        clickedTab = true;
        break;
      }
    }

    // Poll for the file input to appear (it may take a moment after tab switch)
    var fileAttempts = 0;
    var filePoller = setInterval(function () {
      fileAttempts++;

      var fileInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]');
      if (!fileInput) {
        var deepInputs = deepQueryAll('input[type="file"]');
        if (deepInputs.length > 0) fileInput = deepInputs[0];
      }

      if (fileInput) {
        clearInterval(filePoller);
        injectFiles(images);
        if (callback) setTimeout(callback, 500);
        return;
      }

      if (fileAttempts >= 20) { // 20 × 300ms = 6s
        clearInterval(filePoller);
        console.log('[SuperReddit] Submit: could not find file input for images');
        // Try drag-and-drop as fallback
        tryDropImages(images);
        if (callback) setTimeout(callback, 500);
      }
    }, 300);
  }

  function injectFiles(images) {
    // Find file input
    var fileInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]');

    // Deep query if not found
    if (!fileInput) {
      var deepInputs = deepQueryAll('input[type="file"]');
      if (deepInputs.length > 0) fileInput = deepInputs[0];
    }

    if (!fileInput) {
      console.log('[SuperReddit] Submit: could not find file input — trying drag-and-drop area');
      // Try to find a drop zone and trigger a drop event
      tryDropImages(images);
      return;
    }

    console.log('[SuperReddit] Submit: injecting ' + images.length + ' file(s) into file input');

    // Convert base64 dataUrls to File objects
    var dt = new DataTransfer();
    for (var i = 0; i < images.length; i++) {
      try {
        var img = images[i];
        var parts = img.dataUrl.split(',');
        var mimeMatch = parts[0].match(/:(.*?);/);
        var mime = mimeMatch ? mimeMatch[1] : 'image/png';
        var bstr = atob(parts[1]);
        var n = bstr.length;
        var u8arr = new Uint8Array(n);
        for (var j = 0; j < n; j++) u8arr[j] = bstr.charCodeAt(j);
        var file = new File([u8arr], img.name || ('image_' + i + '.png'), { type: mime });
        dt.items.add(file);
      } catch (e) {
        console.log('[SuperReddit] Submit: failed to convert image ' + i + ':', e.message);
      }
    }

    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('[SuperReddit] Submit: dispatched file change event');
  }

  function tryDropImages(images) {
    // Find a drop zone element
    var dropZone = document.querySelector('[class*="drop"], [class*="upload"], [data-testid*="upload"], [data-testid*="drop"]');
    if (!dropZone) {
      console.log('[SuperReddit] Submit: no drop zone found for images');
      return;
    }

    var dt = new DataTransfer();
    for (var i = 0; i < images.length; i++) {
      try {
        var img = images[i];
        var parts = img.dataUrl.split(',');
        var mimeMatch = parts[0].match(/:(.*?);/);
        var mime = mimeMatch ? mimeMatch[1] : 'image/png';
        var bstr = atob(parts[1]);
        var n = bstr.length;
        var u8arr = new Uint8Array(n);
        for (var j = 0; j < n; j++) u8arr[j] = bstr.charCodeAt(j);
        dt.items.add(new File([u8arr], img.name || ('image_' + i + '.png'), { type: mime }));
      } catch (e) { /* skip */ }
    }

    var dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
    dropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
    dropZone.dispatchEvent(dropEvent);
    console.log('[SuperReddit] Submit: dispatched drop event on zone');
  }

  // ---- Routing ----
  if (isOnComposePage()) {
    // Check if this compose page was opened for manual send (queue mode)
    chrome.storage.local.get('sr_pending_compose', function (result) {
      var pending = result.sr_pending_compose;
      if (pending && pending.manual && (Date.now() - pending.timestamp) < 300000) {
        // Queue mode: user will click Send themselves — don't auto-send
        // But still watch for when they DO send, so we can report back
        chrome.storage.local.remove('sr_pending_compose');
        console.log('[SuperReddit] Compose: manual mode — watching for user to click Send');

        var urlParams = new URLSearchParams(location.search);
        var toUsername = urlParams.get('to') || '';

        // Watch for the Send button to appear, then listen for click
        var manualAttempts = 0;
        var manualWatcher = setInterval(function () {
          manualAttempts++;
          if (manualAttempts > 40) { // 40 × 500ms = 20s
            clearInterval(manualWatcher);
            return;
          }
          var btn = findSendButton();
          if (!btn) return;
          clearInterval(manualWatcher);

          console.log('[SuperReddit] Manual mode: found Send button, watching for click');
          btn.addEventListener('click', function () {
            console.log('[SuperReddit] Manual mode: user clicked Send');
            detectSendOutcome(toUsername);
          });

          // Also watch for form submission (Enter key, etc.)
          var form = btn.closest('form');
          if (form) {
            form.addEventListener('submit', function () {
              console.log('[SuperReddit] Manual mode: form submitted');
              detectSendOutcome(toUsername);
            });
          }
        }, 500);
      } else {
        // Existing SEND_DM flow: auto-send on compose page
        handleComposePage();
      }
    });
  } else if (isOnSubmitPage()) {
    handleSubmitPage();
  } else if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(runScan, 2000);
  }
})();
