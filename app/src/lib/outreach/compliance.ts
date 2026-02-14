/**
 * Subreddit rule parsing and safety scoring for outreach compliance.
 */

export interface ComplianceProfile {
  selfPromoAllowed: boolean;
  linkPostsAllowed: boolean;
  minAccountAge: number | null;
  minKarma: number | null;
  flairRequired: boolean;
  restrictedKeywords: string[];
}

export type SafetyLevel = 'safe' | 'caution' | 'strict';

const PROMO_BLOCK_PATTERNS = [
  /no\s*(self[- ]?)?promot/i,
  /no\s*advertis/i,
  /no\s*spam/i,
  /no\s*market/i,
  /no\s*affiliate/i,
];

const ACCOUNT_AGE_PATTERN = /(\d+)\s*(day|week|month)/i;
const KARMA_PATTERN = /(\d+)\s*karma/i;

export function parseComplianceProfile(
  rulesJson: Record<string, unknown>[]
): ComplianceProfile {
  const allText = rulesJson
    .map((r) => `${r.short_name || ''} ${r.description || ''}`)
    .join(' ');

  const selfPromoAllowed = !PROMO_BLOCK_PATTERNS.some((p) => p.test(allText));

  const linkPostsAllowed = !/no\s*link\s*posts?/i.test(allText);

  const ageMatch = allText.match(ACCOUNT_AGE_PATTERN);
  let minAccountAge: number | null = null;
  if (ageMatch) {
    const num = parseInt(ageMatch[1], 10);
    const unit = ageMatch[2].toLowerCase();
    if (unit.startsWith('week')) minAccountAge = num * 7;
    else if (unit.startsWith('month')) minAccountAge = num * 30;
    else minAccountAge = num;
  }

  const karmaMatch = allText.match(KARMA_PATTERN);
  const minKarma = karmaMatch ? parseInt(karmaMatch[1], 10) : null;

  const flairRequired = /flair\s*(is\s*)?required/i.test(allText);

  const restrictedKeywords: string[] = [];
  if (/no\s*referral/i.test(allText)) restrictedKeywords.push('referral');
  if (/no\s*coupon/i.test(allText)) restrictedKeywords.push('coupon');
  if (/no\s*discount/i.test(allText)) restrictedKeywords.push('discount');

  return {
    selfPromoAllowed,
    linkPostsAllowed,
    minAccountAge,
    minKarma,
    flairRequired,
    restrictedKeywords,
  };
}

export function computeSafetyScore(profile: ComplianceProfile): number {
  let score = 1.0;

  if (!profile.selfPromoAllowed) score -= 0.4;
  if (!profile.linkPostsAllowed) score -= 0.1;
  if (profile.minAccountAge && profile.minAccountAge > 30) score -= 0.1;
  if (profile.minKarma && profile.minKarma > 100) score -= 0.1;
  if (profile.flairRequired) score -= 0.05;
  if (profile.restrictedKeywords.length > 0) score -= 0.05 * profile.restrictedKeywords.length;

  return Math.max(0, Math.min(1, score));
}

export function getSafetyLevel(safetyScore: number | null): SafetyLevel {
  if (safetyScore === null) return 'caution';
  if (safetyScore >= 0.7) return 'safe';
  if (safetyScore >= 0.4) return 'caution';
  return 'strict';
}
