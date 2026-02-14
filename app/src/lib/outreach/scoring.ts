/**
 * Combined scoring for outreach signals.
 * Formula: intent(0.5) + freshness(0.3) + engagement(0.2)
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
