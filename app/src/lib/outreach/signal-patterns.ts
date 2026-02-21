/**
 * Tier 1 signal detection: regex-only pattern matching for 7 signal types.
 * Runs on every poll with zero AI cost. Posts scoring >= 3 proceed to Tier 2 AI.
 */

import type { SignalType } from '@/types';

interface PatternMatch {
  type: SignalType;
  weight: number;
  matched: string;
}

export interface Tier1Result {
  score: number;
  matches: PatternMatch[];
  signalTypes: SignalType[];
}

// ---- Pattern definitions per signal type ----

const TOOL_SWITCH_PATTERNS = [
  { pattern: /switch(?:ing|ed)?\s+(?:from|away\s+from)/i, weight: 3 },
  { pattern: /migrat(?:ing|ed|e)\s+(?:from|to|away)/i, weight: 3 },
  { pattern: /replac(?:ing|ed|e)\s+(?:my|our|the)/i, weight: 2 },
  { pattern: /alternative\s+to/i, weight: 3 },
  { pattern: /looking\s+for\s+(?:a\s+)?(?:new|better|different)\s+/i, weight: 2 },
  { pattern: /(?:moved|moving)\s+(?:from|to|away)/i, weight: 2 },
  { pattern: /ditched|dumped|dropped/i, weight: 2 },
  { pattern: /(?:vs|versus|compared?\s+to)\s+/i, weight: 1 },
  { pattern: /tired\s+of\s+(?:using|paying|dealing)/i, weight: 2 },
];

const BUDGET_CONSTRAINT_PATTERNS = [
  { pattern: /(?:free|cheap(?:er)?|budget|affordable)\s+(?:alternative|option|tool|software)/i, weight: 3 },
  { pattern: /too\s+(?:expensive|pricey|costly)/i, weight: 3 },
  { pattern: /(?:can't|cannot)\s+(?:afford|justify)/i, weight: 3 },
  { pattern: /pricing\s+(?:is\s+)?(?:ridiculous|insane|crazy|outrageous)/i, weight: 3 },
  { pattern: /\$\d+\s*\/?\s*(?:mo|month|yr|year)/i, weight: 1 },
  { pattern: /(?:open[\s-]?source|self[\s-]?host(?:ed)?)\s+alternative/i, weight: 2 },
  { pattern: /(?:free\s+tier|free\s+plan|freemium)/i, weight: 1 },
];

const REPEATED_PAIN_PATTERNS = [
  { pattern: /(?:still|keep|always)\s+(?:struggling|having\s+(?:issues|problems|trouble))/i, weight: 3 },
  { pattern: /(?:frustrated|frustrating|annoying|annoyed)\s+(?:with|by|that)/i, weight: 2 },
  { pattern: /(?:broken|buggy|unreliable|slow)\s+(?:again|still|as\s+always)/i, weight: 3 },
  { pattern: /(?:anyone\s+else|am\s+i\s+the\s+only)\s+(?:having|experiencing|dealing)/i, weight: 2 },
  { pattern: /(?:pain\s+point|deal[\s-]?breaker|showstopper)/i, weight: 2 },
  { pattern: /(?:hate|can't\s+stand|fed\s+up|sick\s+of)/i, weight: 2 },
];

const HIGH_SIGNAL_COMMENT_PATTERNS = [
  { pattern: /(?:what|which)\s+(?:tool|software|app|platform|service)\s+(?:do|should|would|can)/i, weight: 3 },
  { pattern: /(?:recommend(?:ation)?s?|suggest(?:ion)?s?)\s+(?:for|on|about)/i, weight: 2 },
  { pattern: /(?:help|advice|tips)\s+(?:with|for|on|about|needed|wanted|please)/i, weight: 2 },
  { pattern: /(?:how\s+do\s+(?:you|i|we))\s+(?:handle|manage|deal\s+with|solve)/i, weight: 2 },
  { pattern: /(?:best|top|go[\s-]?to)\s+(?:tool|software|app|platform|solution|way)/i, weight: 2 },
];

const MOD_SAFE_PATTERNS = [
  // Posts that are questions/discussions (generally mod-safe for replies)
  { pattern: /\?\s*$/m, weight: 1 },
  { pattern: /(?:seeking|looking\s+for|in\s+search\s+of|need)\s+(?:advice|help|input|feedback)/i, weight: 2 },
  { pattern: /(?:discussion|thoughts|opinions|experiences)\s+(?:on|about|regarding)/i, weight: 1 },
];

const TREND_CLUSTER_PATTERNS = [
  { pattern: /(?:trending|gaining\s+(?:traction|popularity)|on\s+the\s+rise)/i, weight: 2 },
  { pattern: /(?:everyone|people)\s+(?:is|are)\s+(?:talking|switching|moving)/i, weight: 2 },
  { pattern: /(?:2024|2025|2026)\s+(?:best|top|new|trending)/i, weight: 1 },
  { pattern: /(?:latest|newest|just\s+(?:launched|released|dropped))/i, weight: 1 },
];

const CONVERTIBLE_THREAD_PATTERNS = [
  { pattern: /(?:looking\s+to|want\s+to|need\s+to)\s+(?:buy|purchase|subscribe|sign\s+up|try)/i, weight: 3 },
  { pattern: /(?:ready\s+to|about\s+to|going\s+to)\s+(?:switch|migrate|upgrade|change)/i, weight: 3 },
  { pattern: /(?:where\s+can\s+i|how\s+(?:do\s+i|can\s+i))\s+(?:get|find|buy|sign\s+up)/i, weight: 2 },
  { pattern: /(?:taking|accepting)\s+(?:recommendations|suggestions)/i, weight: 2 },
  { pattern: /(?:link|url|pricing|plans)\s*\?/i, weight: 2 },
  { pattern: /(?:shut\s+up\s+and\s+take\s+my\s+money|take\s+my\s+money)/i, weight: 3 },
];

const ALL_PATTERNS: { type: SignalType; patterns: { pattern: RegExp; weight: number }[] }[] = [
  { type: 'tool_switch', patterns: TOOL_SWITCH_PATTERNS },
  { type: 'budget_constraint', patterns: BUDGET_CONSTRAINT_PATTERNS },
  { type: 'repeated_pain', patterns: REPEATED_PAIN_PATTERNS },
  { type: 'high_signal_comment', patterns: HIGH_SIGNAL_COMMENT_PATTERNS },
  { type: 'mod_safe', patterns: MOD_SAFE_PATTERNS },
  { type: 'trend_cluster', patterns: TREND_CLUSTER_PATTERNS },
  { type: 'convertible_thread', patterns: CONVERTIBLE_THREAD_PATTERNS },
];

/**
 * Run Tier 1 regex scoring on a post's text content.
 * Returns a score 0-10 and matched signal types.
 */
export function tier1Score(title: string, body: string | null): Tier1Result {
  const text = `${title} ${body || ''}`;
  const matches: PatternMatch[] = [];
  const typeSet = new Set<SignalType>();

  for (const group of ALL_PATTERNS) {
    for (const { pattern, weight } of group.patterns) {
      const match = text.match(pattern);
      if (match) {
        matches.push({ type: group.type, weight, matched: match[0] });
        typeSet.add(group.type);
      }
    }
  }

  // Sum weights, cap at 10
  const rawScore = matches.reduce((sum, m) => sum + m.weight, 0);
  const score = Math.min(10, rawScore);

  return {
    score,
    matches,
    signalTypes: Array.from(typeSet),
  };
}

/**
 * Check if a post's text matches any competitor names.
 * Returns matched competitor names with surrounding context.
 */
export function findCompetitorMentions(
  text: string,
  competitors: string[]
): { name: string; context: string }[] {
  const results: { name: string; context: string }[] = [];
  const lower = text.toLowerCase();

  for (const comp of competitors) {
    const compLower = comp.toLowerCase();
    const idx = lower.indexOf(compLower);
    if (idx !== -1) {
      // Extract surrounding context (50 chars each side)
      const start = Math.max(0, idx - 50);
      const end = Math.min(text.length, idx + comp.length + 50);
      results.push({
        name: comp,
        context: text.slice(start, end).trim(),
      });
    }
  }

  return results;
}
