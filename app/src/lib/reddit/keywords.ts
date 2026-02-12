/**
 * Lightweight keyword extractor for Reddit discover searches.
 * Adapted from extractSearchTerms in app/src/app/api/ai/suggest-subreddits/route.ts
 *
 * Builds compound search queries that combine context for specificity,
 * e.g. "One Piece TCG" instead of just "One Piece".
 */

export function extractDiscoverKeywords(
  productName: string,
  productDescription: string,
  targetAudience?: string | null,
  trackedSubreddits?: string[]
): string[] {
  const terms: string[] = [];

  // 1. Tracked subreddit names are the strongest relevance signal —
  //    searching these finds sibling communities the user doesn't track yet
  if (trackedSubreddits?.length) {
    for (const sub of trackedSubreddits.slice(0, 3)) {
      // Split camelCase/PascalCase sub names into readable queries
      // e.g. "OnePieceTCG" → "One Piece TCG"
      const spaced = sub.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
      terms.push(spaced);
    }
  }

  // 2. Compound queries: combine audience segments with product name for specificity
  //    e.g. audience "TCG collectors" + name "CardTracker" → "TCG collectors CardTracker"
  if (targetAudience) {
    const segments = targetAudience.split(',').map((s) => s.trim()).filter((s) => s.length > 2);
    for (const seg of segments.slice(0, 2)) {
      // Audience segment alone as a query
      terms.push(seg);
      // Compound: segment + product name (more specific)
      if (seg.toLowerCase() !== productName.toLowerCase()) {
        terms.push(`${seg} ${productName}`);
      }
    }
  }

  // 3. Product name on its own
  terms.push(productName);

  // Dedupe case-insensitive, cap at 6
  const seen = new Set<string>();
  return terms.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}
