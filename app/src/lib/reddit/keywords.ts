/**
 * Lightweight keyword extractor for Reddit discover searches.
 * Adapted from extractSearchTerms in app/src/app/api/ai/suggest-subreddits/route.ts
 */

export function extractDiscoverKeywords(
  productName: string,
  productDescription: string,
  targetAudience?: string | null
): string[] {
  const terms: string[] = [];

  // Target audience segments first — these describe the communities we want
  if (targetAudience) {
    const segments = targetAudience.split(',').map((s) => s.trim()).filter((s) => s.length > 2);
    segments.forEach((seg) => terms.push(seg));
  }

  // Product name
  terms.push(productName);

  // Capitalized phrases from description (proper nouns, brand names, etc.)
  const capitalMatches = productDescription.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (capitalMatches) {
    const stopPhrases = new Set(['the', 'this', 'that', 'with', 'from', 'into', 'also']);
    capitalMatches.forEach((m) => {
      if (m.length > 3 && !stopPhrases.has(m.toLowerCase())) {
        terms.push(m);
      }
    });
  }

  // Dedupe case-insensitive, cap at 6
  const seen = new Set<string>();
  return terms.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}
