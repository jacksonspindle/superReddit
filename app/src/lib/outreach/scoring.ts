/**
 * Combined scoring for outreach signals.
 * Enhanced formula: signal_strength(0.4) + freshness(0.25) + engagement(0.15) + safety(0.1) + competitor_bonus(0.1)
 */

const MAX_AGE_HOURS = 72; // Posts older than 72h get 0 freshness score

export function computeFreshnessScore(createdUtc: number): number {
  const ageHours = (Date.now() / 1000 - createdUtc) / 3600;
  if (ageHours <= 0) return 1;
  if (ageHours >= MAX_AGE_HOURS) return 0;
  return 1 - ageHours / MAX_AGE_HOURS;
}

export function computeEngagementScore(score: number, numComments: number): number {
  // Normalize: log scale to handle viral posts gracefully
  const scoreNorm = Math.min(1, Math.log10(Math.max(1, score)) / 4); // 10k = 1.0
  const commentsNorm = Math.min(1, Math.log10(Math.max(1, numComments)) / 3); // 1k = 1.0
  return scoreNorm * 0.6 + commentsNorm * 0.4;
}

/**
 * Compute safety component score from safety level.
 */
export function computeSafetyComponent(safetyLevel: 'safe' | 'caution' | 'strict' | null): number {
  if (safetyLevel === 'safe') return 1.0;
  if (safetyLevel === 'caution') return 0.5;
  if (safetyLevel === 'strict') return 0.1;
  return 0.5; // unknown defaults to caution-level
}

/**
 * Compute competitor bonus. Posts mentioning competitors with switching intent score higher.
 */
export function computeCompetitorBonus(
  competitorMentioned: boolean,
  switchingIntent?: boolean
): number {
  if (!competitorMentioned) return 0;
  if (switchingIntent) return 1.0;
  return 0.5;
}

/**
 * Legacy scoring (backward compatible): intent(0.5) + freshness(0.3) + engagement(0.2)
 */
export function computeCombinedScore(
  intentScore: number,
  createdUtc: number,
  redditScore: number,
  numComments: number
): number {
  const freshness = computeFreshnessScore(createdUtc);
  const engagement = computeEngagementScore(redditScore, numComments);
  return intentScore * 0.5 + freshness * 0.3 + engagement * 0.2;
}

// ---- V2 Scoring ----

import type { LeadTier, BuyerIntent } from '@/types';

export function computeV2CombinedScore(fitScore: number, leadScore: number, engageScore: number): number {
  return (fitScore * 0.4 + leadScore * 0.35 + engageScore * 0.25) / 10;
}

export function deriveLeadTier(fitScore: number, leadScore: number): LeadTier {
  if (fitScore >= 8 && leadScore >= 7) return 'hot';
  if (fitScore >= 6 && leadScore >= 5) return 'warm';
  return 'cold';
}

// ---- V3 Scoring ----

export function computeV3CombinedScore(fit: number, lead: number, authenticity: number, relevance: number): number {
  return (fit * 0.30 + lead * 0.30 + authenticity * 0.20 + relevance * 0.20) / 10;
}

export function deriveLeadTierV3(fit: number, lead: number, authenticity: number, relevance: number): LeadTier {
  if (fit >= 7 && lead >= 7 && authenticity >= 6 && relevance >= 5) return 'hot';
  if (fit >= 5 && lead >= 5 && authenticity >= 4) return 'warm';
  return 'cold';
}

/**
 * Enhanced scoring with all 5 factors:
 * signal_strength(0.4) + freshness(0.25) + engagement(0.15) + safety(0.1) + competitor_bonus(0.1)
 */
export function computeEnhancedScore(params: {
  intentScore: number;
  createdUtc: number;
  redditScore: number;
  numComments: number;
  safetyLevel?: 'safe' | 'caution' | 'strict' | null;
  competitorMentioned?: boolean;
  switchingIntent?: boolean;
}): number {
  const freshness = computeFreshnessScore(params.createdUtc);
  const engagement = computeEngagementScore(params.redditScore, params.numComments);
  const safety = computeSafetyComponent(params.safetyLevel ?? null);
  const competitor = computeCompetitorBonus(
    params.competitorMentioned ?? false,
    params.switchingIntent
  );

  return (
    params.intentScore * 0.4 +
    freshness * 0.25 +
    engagement * 0.15 +
    safety * 0.1 +
    competitor * 0.1
  );
}
