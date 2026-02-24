import type { ConversationMessage } from '@/hooks/useRedditBridge';

// Global cache: once we discover the logged-in user's chat author name
// (e.g. "opcollectr") from ANY conversation, reuse it for all others.
// This persists for the lifetime of the page — no per-card guessing needed.
export let _myAuthorName: string | undefined;

/**
 * Post-process scraped DOM messages: remove duplicates, fix authorship,
 * and filter out cross-conversation contamination.
 *
 * @param myUsername — the logged-in Reddit username. When provided, any
 *   message whose author doesn't match either participant is dropped
 *   (the extension sometimes returns messages from a different chat).
 */
export function deduplicateMessages(
  messages: ConversationMessage[],
  otherUsername: string,
  myUsername?: string,
  sentBody?: string,
): ConversationMessage[] {
  if (messages.length === 0) return messages;

  const otherLower = otherUsername.toLowerCase();
  const timestampOnly = /^\d{1,2}:\d{2}\s*(AM|PM)?$/i;
  const timestampPrefix = /^\d{1,2}:\d{2}\s*(AM|PM)\s+/i;

  const uiChrome = new Set([
    'send message', 'type a message', 'send', 'message',
    'start a conversation', 'say something nice',
  ]);

  const processed = messages
    .filter((msg) => !timestampOnly.test(msg.text.trim()))
    .filter((msg) => !uiChrome.has(msg.text.trim().toLowerCase()))
    .map((msg) => ({
      ...msg,
      text: msg.text.replace(timestampPrefix, '').trim(),
      author: msg.author === 'them' ? otherLower : msg.author,
    }))
    .filter((msg) => msg.text.length > 0);

  const seen = new Set<string>();
  const deduped = processed.filter((msg) => {
    const key = msg.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // --- Determine "my" author name (the logged-in user's chat display name) ---
  // The extension's isFromYou is unreliable and author names don't match
  // Reddit usernames. We identify "me" once and cache it globally.
  const uniqueAuthors = [...new Set(deduped.map((m) => m.author.toLowerCase()))];

  if (uniqueAuthors.length === 2) {
    let discovered = _myAuthorName;

    // If already cached, verify it's one of the two authors in this conversation
    if (discovered && !uniqueAuthors.includes(discovered)) {
      discovered = undefined;
    }

    // Try to discover from known myUsername (bridge redditUsername)
    if (!discovered && myUsername) {
      discovered = uniqueAuthors.find((a) => a === myUsername.toLowerCase());
    }

    // Try to discover from sent message body — find a message matching
    // dm.dm_body, that message's author is "me"
    if (!discovered && sentBody) {
      const sentLower = sentBody.trim().toLowerCase();
      if (sentLower) {
        const match = deduped.find((m) => {
          const msgLower = m.text.trim().toLowerCase();
          return msgLower === sentLower
            || msgLower.includes(sentLower)
            || sentLower.includes(msgLower);
        });
        if (match) discovered = match.author.toLowerCase();
      }
    }

    // Outreach heuristic: we always send the first message in a conversation,
    // so the first message's author is "me"
    if (!discovered && deduped.length > 0) {
      discovered = deduped[0].author.toLowerCase();
    }

    // Cache globally so every future conversation uses this immediately
    if (discovered) {
      _myAuthorName = discovered;
    }

    if (discovered) {
      return deduped.map((m) => ({
        ...m,
        isFromYou: m.author.toLowerCase() === discovered,
      }));
    }
  } else if (uniqueAuthors.length === 1) {
    // Single author visible after dedup — the extension may have attributed
    // all messages to one side. We can still determine isFromYou if we know
    // which side this author represents.
    const singleAuthor = uniqueAuthors[0];
    const myLower = myUsername?.toLowerCase();

    let allFromYou: boolean | undefined;
    if (myLower && singleAuthor === myLower) allFromYou = true;
    else if (singleAuthor === otherLower) allFromYou = false;
    else if (_myAuthorName && singleAuthor === _myAuthorName) allFromYou = true;

    if (allFromYou !== undefined) {
      return deduped.map((m) => ({ ...m, isFromYou: allFromYou! }));
    }
  }

  return deduped;
}
