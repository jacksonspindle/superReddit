import { normalizeText } from '../utils/normalize.js';

interface KeywordGroup {
  id: string;
  phrases: string[];
  exclusions: string[];
  is_active: boolean;
  silenced_until: string | null;
}

interface MatchResult {
  keywordId: string;
  matchedPhrase: string;
}

/**
 * Check if text matches any active keyword phrases with word boundary matching.
 * Returns all matches found.
 */
export function findMatches(
  text: string,
  keywords: KeywordGroup[]
): MatchResult[] {
  const normalizedText = normalizeText(text);
  const results: MatchResult[] = [];

  for (const keyword of keywords) {
    if (!keyword.is_active) continue;

    // Skip if silenced
    if (keyword.silenced_until && new Date(keyword.silenced_until) > new Date()) {
      continue;
    }

    for (const phrase of keyword.phrases) {
      const normalizedPhrase = normalizeText(phrase);

      // Word boundary matching
      if (matchesWithBoundary(normalizedText, normalizedPhrase)) {
        // Check exclusions
        const excluded = keyword.exclusions.some((excl) =>
          matchesWithBoundary(normalizedText, normalizeText(excl))
        );

        if (!excluded) {
          results.push({
            keywordId: keyword.id,
            matchedPhrase: phrase,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Word boundary matching: phrase must appear as a complete word/phrase,
 * not as a substring of another word.
 */
function matchesWithBoundary(text: string, phrase: string): boolean {
  // Escape regex special characters in the phrase
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}
