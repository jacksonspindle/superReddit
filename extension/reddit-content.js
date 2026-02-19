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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SCAN_DATA') {
      console.log('[SuperReddit] GET_SCAN_DATA pull request — returning', latestScanData.usernames.length, 'usernames');
      sendResponse(latestScanData);
      return true;
    }
    if (message.type === 'SCRAPE_OPEN_THREAD') {
      // Attempt to scrape messages from the currently visible chat thread DOM
      const threadMessages = scrapeVisibleThread();
      sendResponse({ messages: threadMessages });
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
        console.log('[SuperReddit] WS: intercepted ' + wsMessages.length + ' messages but could not identify conversation partner');
        return;
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
      console.log('[SuperReddit] Intercepted ' + messages.length + ' messages but could not identify conversation partner');
      return;
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

  // ---- Routing ----
  if (isOnComposePage()) {
    // Auto-send on compose page (opened by SEND_DM)
    handleComposePage();
  } else if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(runScan, 2000);
  }
})();
