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
  // Reddit chat uses <a href="/room/..."> with <span class="room-name"> for usernames
  // and aria-label="Direct chat with USERNAME" on each conversation item.
  // Message previews show "You: message" or "Username: message" in the second row.

  function classifyConversations() {
    const youSentTo = new Set();
    const theyReplied = new Set();
    const previews = {};
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

    console.log('[SuperReddit] classify: ' + processed.size + ' users, ' + youSentTo.size + ' youSentTo, ' + theyReplied.size + ' theyReplied (via ' + chatLinks.length + ' aria-labels)');
    if (youSentTo.size > 0) console.log('[SuperReddit]   youSentTo:', Array.from(youSentTo));
    if (theyReplied.size > 0) console.log('[SuperReddit]   theyReplied:', Array.from(theyReplied));

    return {
      youSentTo: Array.from(youSentTo),
      theyReplied: Array.from(theyReplied),
      previews,
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
  let autoScrollRetries = 0;

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
    const convLinks = deepQueryAll('a[aria-label*="Direct chat with"]');
    if (convLinks.length === 0) {
      autoScrollRetries++;
      if (autoScrollRetries < 5) {
        console.log('[SuperReddit] No conversation links yet — retry ' + autoScrollRetries + '/5 in 3s');
        setTimeout(autoScrollSidebar, 3000);
      } else {
        console.log('[SuperReddit] Auto-scroll: gave up finding conversation links');
      }
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
    const accumulated = { usernames: new Set(), youSentTo: new Set(), theyReplied: new Set(), previews: {} };

    // Capture what's visible now (before scrolling)
    function captureVisible() {
      const { youSentTo, theyReplied, previews } = classifyConversations();
      const usernames = scanChatUsernames();
      for (const u of usernames) accumulated.usernames.add(u);
      for (const u of youSentTo) accumulated.youSentTo.add(u);
      for (const u of theyReplied) accumulated.theyReplied.add(u);
      Object.assign(accumulated.previews, previews);
    }

    captureVisible();
    console.log('[SuperReddit] Auto-scroll: starting with ' + accumulated.usernames.size + ' unique users');

    let scrollRound = 0;
    const MAX_ROUNDS = 40;
    let staleRounds = 0;

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

        // Store accumulated results
        storeResults(finalUsernames, finalYouSentTo, finalTheyReplied, accumulated.previews);

        // Scroll back to top
        scrollTarget.scrollTop = 0;
        if (scrollTarget !== sidebarContainer) sidebarContainer.scrollTop = 0;
      }
    }, 1200);
  }

  // ---- Send consolidated scan result to background ----
  let lastSentCount = 0;

  function sendScanResult() {
    const allUsernames = scanChatUsernames();
    const { youSentTo, theyReplied, previews } = classifyConversations();

    // Only send if we have new data
    if (allUsernames.length > 0 && allUsernames.length !== lastSentCount) {
      lastSentCount = allUsernames.length;
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

    // Send results at intervals — sendScanResult is idempotent (only sends if count changed)
    setTimeout(sendScanResult, 8_000);
    setTimeout(sendScanResult, 15_000);
    setTimeout(sendScanResult, 25_000);
    setTimeout(sendScanResult, 45_000);
    setTimeout(sendScanResult, 60_000);
  }

  if (isOnChatPage()) {
    startScanning();
  } else {
    setTimeout(runScan, 2000);
  }
})();
