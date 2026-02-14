import type { PermissionType } from '@/types';

export interface PermissionResult {
  type: PermissionType;
  score: number;
  matchedPattern: string | null;
}

// Tier 1: Explicit DM request patterns (score 0.95)
const EXPLICIT_DM_PATTERNS = [
  /\bdm\s+me\b/i,
  /\bpm\s+me\b/i,
  /\bsend\s+me\s+(a\s+)?(dm|pm|message)\b/i,
  /\bmessage\s+me\b/i,
  /\bcan\s+you\s+(dm|pm|message)\s+me\b/i,
  /\bshoot\s+me\s+a\s+(dm|pm|message)\b/i,
  /\bdrop\s+me\s+a\s+(dm|pm|message|line)\b/i,
  /\bhit\s+me\s+up\b/i,
  /\b(i('d|\s+would)\s+love|please)\s+(a\s+)?(dm|pm|message)\b/i,
  /\bslide\s+into\s+(my\s+)?(dm|pm)s?\b/i,
  /\bsend\s+(it|that|the\s+link|the\s+info)\s+(to\s+)?me\b/i,
  /\bcan\s+(i|you)\s+get\s+(that|it|a\s+link)\s+(via\s+)?(dm|pm|message)?\b/i,
  /\bi('ll|will)\s+(dm|pm|message)\s+you\b/i,
  /\bcheck\s+(your|my)\s+(dm|pm|inbox)\b/i,
];

// Tier 2: Positive reply patterns (score 0.75, requires isReplyToUser)
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

export function detectPermission(
  commentText: string,
  isReplyToUser: boolean
): PermissionResult {
  // Tier 1: Check for explicit DM request
  for (const pattern of EXPLICIT_DM_PATTERNS) {
    const match = commentText.match(pattern);
    if (match) {
      return {
        type: 'explicit_dm_request',
        score: 0.95,
        matchedPattern: match[0],
      };
    }
  }

  // Tier 2: Check for positive reply (only if it's a direct reply to the user)
  if (isReplyToUser) {
    for (const pattern of POSITIVE_REPLY_PATTERNS) {
      const match = commentText.match(pattern);
      if (match) {
        return {
          type: 'positive_reply',
          score: 0.75,
          matchedPattern: match[0],
        };
      }
    }
  }

  // Tier 3: Passive commenter (fallback)
  return {
    type: 'passive_commenter',
    score: 0.3,
    matchedPattern: null,
  };
}
