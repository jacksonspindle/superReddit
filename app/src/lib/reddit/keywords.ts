/**
 * Builds search queries for discovering related subreddits.
 *
 * Uses the user's own words from onboarding — target audience segments,
 * product description, and tracked subreddit names — as natural-language
 * search queries. No synthetic transformations.
 */

export function extractDiscoverKeywords(
  productName: string,
  productDescription: string,
  targetAudience?: string | null,
  trackedSubreddits?: string[]
): string[] {
  const terms: string[] = [];

  // 1. Target audience segments — the user literally told us what communities
  //    they care about, e.g. "TCG collectors, One Piece card traders"
  if (targetAudience) {
    const segments = targetAudience.split(',').map((s) => s.trim()).filter((s) => s.length > 2);
    segments.forEach((seg) => terms.push(seg));
  }

  // 2. Full product description — the richest context the user provided
  if (productDescription.trim().length > 10) {
    terms.push(productDescription.trim());
  }

  // 3. Product name
  terms.push(productName);

  // 4. All tracked subreddit names — Reddit search finds sibling communities from these
  if (trackedSubreddits?.length) {
    for (const sub of trackedSubreddits) {
      terms.push(sub);
    }
  }

  // Dedupe case-insensitive
  const seen = new Set<string>();
  return terms.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
