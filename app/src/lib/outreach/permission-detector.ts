import type { PermissionType } from '@/types';

export interface PermissionResult {
  type: PermissionType;
  score: number;
  matchedPattern: string | null;
}

// ── Word categories for proximity-based DM request detection ────────────────

/** Contact channel nouns */
const CONTACT_WORDS = new Set([
  'dm', 'dms', 'pm', 'pms', 'message', 'messages', 'msg', 'inbox', 'chat',
]);

/** Private / offline modifiers */
const PRIVATE_WORDS = new Set([
  'privately', 'private', 'offline', 'direct', 'personally',
]);

/** Verbs that imply sending / sharing something */
const SEND_VERBS = new Set([
  'send', 'share', 'shoot', 'drop', 'pass', 'forward',
  'give', 'flick', 'toss', 'hit',
]);

/** Verbs that imply reaching out or making contact */
const REACH_VERBS = new Set([
  'reach', 'contact', 'connect', 'touch', 'holler',
]);

/** Invitation / inclusion words */
const INVITE_WORDS = new Set([
  'invite', 'add', 'hook', 'include', 'put',
]);

/** Self-reference (direct/indirect object) */
const SELF_WORDS = new Set(['me', 'my', 'mine']);

/** Openness / availability */
const OPEN_WORDS = new Set([
  'open', 'available', 'free', 'ready', 'welcome',
]);

/** Interest / desire signals */
const INTEREST_WORDS = new Set([
  'interested', 'love', 'want', 'down', 'sure',
  'definitely', 'absolutely', 'happy', 'glad', 'please',
]);

/** Access / joining words */
const ACCESS_WORDS = new Set([
  'access', 'join', 'try', 'beta', 'waitlist', 'list', 'signup', 'trial',
]);

/** Negation words that invert the intent of nearby signals */
const NEGATION_WORDS = new Set([
  'not', 'no', 'dont', 'never', 'stop', 'hate',
  'cant', 'wont', 'without',
]);

/** Single tokens that are unambiguous DM requests on their own */
const STANDALONE_SIGNALS = new Set(['hmu']);

// ── Exact patterns for structures that proximity alone misses ───────────────

const EXACT_DM_PATTERNS = [
  /\bi('ll|will)\s+(dm|pm|message)\s+you\b/i,
  /\bcheck\s+(your|my)\s+(dm|pm|inbox)s?\b/i,
  /\b(let('s|\s+us)|we\s+should)\s+(chat|talk|connect|dm)\b/i,
  /\bwould\s+love\s+to\s+(chat|talk|connect|hear\s+more)\b/i,
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const WINDOW_SIZE = 8;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[''`]/g, '')     // "don't" → "dont", "i'm" → "im"
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// ── Proximity detection ─────────────────────────────────────────────────────
//
// Instead of requiring exact phrases, we check whether signal words from
// different categories co-occur within a sliding window of WINDOW_SIZE words.
// This catches every natural phrasing — "yeah sure you can message me about it",
// "feel free to reach out whenever", "happy to chat privately", etc. — without
// needing a bespoke regex for each variation.

function detectProximityDmRequest(text: string): string | null {
  const words = tokenize(text);

  // Standalone tokens (e.g. "hmu")
  for (const w of words) {
    if (STANDALONE_SIGNALS.has(w)) return w;
  }

  // Sliding window
  for (let i = 0; i < words.length; i++) {
    const end = Math.min(i + WINDOW_SIZE, words.length);
    const win = words.slice(i, end);

    // Skip any window that contains a negation word
    if (win.some(w => NEGATION_WORDS.has(w))) continue;

    const has = {
      contact:  win.some(w => CONTACT_WORDS.has(w)),
      private_: win.some(w => PRIVATE_WORDS.has(w)),
      send:     win.some(w => SEND_VERBS.has(w)),
      reach:    win.some(w => REACH_VERBS.has(w)),
      invite:   win.some(w => INVITE_WORDS.has(w)),
      self:     win.some(w => SELF_WORDS.has(w)),
      open:     win.some(w => OPEN_WORDS.has(w)),
      interest: win.some(w => INTEREST_WORDS.has(w)),
      access:   win.some(w => ACCESS_WORDS.has(w)),
    };

    const matched = win.join(' ');

    // ── Self-reference + action/channel ──────────────────────────────────
    // "dm me", "send me details", "reach out to me", "invite me"
    if (has.self && (has.contact || has.send || has.reach || has.invite)) {
      return matched;
    }

    // ── Channel + openness ──────────────────────────────────────────────
    // "dms are open", "inbox is available", "my chat is always open"
    if (has.contact && has.open) return matched;

    // ── Private modifier + signal ───────────────────────────────────────
    // "happy to discuss privately", "send it in private", "chat privately"
    if (has.private_ && (has.interest || has.send || has.contact || has.reach)) {
      return matched;
    }

    // ── Interest + channel ──────────────────────────────────────────────
    // "interested in a dm", "would love a message", "down for a chat"
    if (has.interest && has.contact) return matched;

    // ── Interest + access ───────────────────────────────────────────────
    // "would love to try", "definitely want to join the beta"
    if (has.interest && has.access) return matched;

    // ── Interest + reach ────────────────────────────────────────────────
    // "would love to connect", "happy to touch base"
    if (has.interest && has.reach) return matched;

    // ── Send + channel (directing to a medium) ──────────────────────────
    // "send via dm", "share it in a message"
    if (has.send && has.contact) return matched;

    // ── Reach + openness ────────────────────────────────────────────────
    // "feel free to reach out", "welcome to contact anytime"
    if (has.reach && has.open) return matched;
  }

  return null;
}

// ── Tier 2: Positive reply patterns (score 0.75, requires isReplyToUser) ────

const POSITIVE_REPLY_PATTERNS = [
  /\bsounds?\s+(great|amazing|awesome|good|interesting|perfect)\b/i,
  /\b(very\s+)?interested\b/i,
  /\bwhere\s+can\s+i\s+(find|get|try|sign\s+up|download)\b/i,
  /\bhow\s+(do|can)\s+(i|we)\s+(get|try|use|access|sign\s+up)\b/i,
  /\bdo\s+you\s+have\s+a\s+(link|url|website)\b/i,
  /\bwhat('s|\s+is)\s+(the|your)\s+(link|url|website|pricing)\b/i,
  /\bi('d|\s+would)\s+love\s+to\s+(try|check|see|learn)\b/i,
  /\bthat('s|\s+is)\s+(exactly|just)\s+what\s+i\s+(need|was\s+looking\s+for)\b/i,
  /\bcan\s+(i|you)\s+share\s+(more|the\s+link|details)\b/i,
  /\btell\s+me\s+more\b/i,
  /\bthis\s+is\s+(awesome|great|amazing|perfect|exactly\s+what)\b/i,
  /\byes\s+please\b/i,
  /\bcount\s+me\s+in\b/i,
  /\bsign\s+me\s+up\b/i,
  /\bi('m|\s+am)\s+(in|down|interested)\b/i,
  /\btake\s+my\s+money\b/i,
];

// ── Main detection ──────────────────────────────────────────────────────────

export function detectPermission(
  commentText: string,
  isReplyToUser: boolean
): PermissionResult {
  // Tier 1a: Exact patterns for structures proximity can't express
  for (const pattern of EXACT_DM_PATTERNS) {
    const match = commentText.match(pattern);
    if (match) {
      return { type: 'explicit_dm_request', score: 0.95, matchedPattern: match[0] };
    }
  }

  // Tier 1b: Proximity-based DM request detection
  const proximityMatch = detectProximityDmRequest(commentText);
  if (proximityMatch) {
    return { type: 'explicit_dm_request', score: 0.95, matchedPattern: proximityMatch };
  }

  // Tier 2: Positive reply (only for direct replies to the user)
  if (isReplyToUser) {
    for (const pattern of POSITIVE_REPLY_PATTERNS) {
      const match = commentText.match(pattern);
      if (match) {
        return { type: 'positive_reply', score: 0.75, matchedPattern: match[0] };
      }
    }
  }

  // Tier 3: Passive commenter (fallback)
  return { type: 'passive_commenter', score: 0.3, matchedPattern: null };
}
