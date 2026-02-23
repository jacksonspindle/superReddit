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

import type { LeadTier, BuyerIntent, Urgency } from '@/types';

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

// ---- V3 Enhanced Scoring (intent-boosted) ----

const BUYER_INTENT_BONUS: Record<BuyerIntent, number> = {
  problem_aware: 0,
  solution_seeking: 0.04,
  comparing: 0.07,
  ready_to_buy: 0.12,
};

const PAIN_SEVERITY_BONUS: Record<string, number> = {
  low: 0,
  medium: 0.02,
  high: 0.05,
};

const URGENCY_BONUS: Record<Urgency, number> = {
  none: 0,
  low: 0.01,
  medium: 0.03,
  high: 0.06,
};

export function computeV3CombinedScoreEnhanced(params: {
  fit: number;
  lead: number;
  authenticity: number;
  relevance: number;
  buyerIntent: BuyerIntent;
  decisionMaker: boolean;
  painSeverity: string | null;
  competitorMentioned: boolean;
  switchingIntent: boolean;
  urgency?: Urgency;
}): number {
  const base = (params.fit * 0.30 + params.lead * 0.30 + params.authenticity * 0.20 + params.relevance * 0.20) / 10;

  let bonus = 0;
  bonus += BUYER_INTENT_BONUS[params.buyerIntent] ?? 0;
  if (params.decisionMaker) bonus += 0.05;
  bonus += PAIN_SEVERITY_BONUS[params.painSeverity ?? 'low'] ?? 0;
  if (params.competitorMentioned && params.switchingIntent) bonus += 0.08;
  bonus += URGENCY_BONUS[params.urgency ?? 'none'] ?? 0;

  return Math.min(1.0, base + bonus);
}

export function deriveLeadTierV3Enhanced(params: {
  fit: number;
  lead: number;
  authenticity: number;
  relevance: number;
  buyerIntent: BuyerIntent;
  decisionMaker: boolean;
  painSeverity: string | null;
  competitorMentioned: boolean;
  switchingIntent: boolean;
}): LeadTier {
  const { fit, lead, authenticity, relevance, buyerIntent, decisionMaker, painSeverity, competitorMentioned, switchingIntent } = params;

  // Intent-boosted HOT: ready_to_buy/comparing + strong scores
  if ((buyerIntent === 'ready_to_buy' || buyerIntent === 'comparing') &&
      fit >= 5 && lead >= 6 && authenticity >= 5 && relevance >= 4) {
    return 'hot';
  }

  // DM+pain HOT: decision maker + high pain + strong scores
  if (decisionMaker && painSeverity === 'high' &&
      fit >= 5 && lead >= 5 && authenticity >= 5 && relevance >= 4) {
    return 'hot';
  }

  // Competitor switch HOT: competitor mentioned + switching intent + strong scores
  if (competitorMentioned && switchingIntent && fit >= 5 && lead >= 5) {
    return 'hot';
  }

  // Original HOT threshold
  if (fit >= 7 && lead >= 7 && authenticity >= 6 && relevance >= 5) {
    return 'hot';
  }

  // Intent-boosted WARM: solution_seeking/comparing/ready_to_buy + moderate scores
  if ((buyerIntent === 'solution_seeking' || buyerIntent === 'comparing' || buyerIntent === 'ready_to_buy') &&
      fit >= 4 && lead >= 4 && authenticity >= 3) {
    return 'warm';
  }

  // Original WARM threshold
  if (fit >= 5 && lead >= 5 && authenticity >= 4) {
    return 'warm';
  }

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
