import { describe, it, expect } from 'vitest';
import { findMatches } from '../services/matcher.js';

function makeKeyword(overrides: Partial<{
  id: string;
  phrases: string[];
  exclusions: string[];
  is_active: boolean;
  silenced_until: string | null;
}> = {}) {
  return {
    id: 'kw-1',
    phrases: ['saas'],
    exclusions: [],
    is_active: true,
    silenced_until: null,
    ...overrides,
  };
}

describe('findMatches', () => {
  it('matches a simple keyword', () => {
    const keywords = [makeKeyword({ phrases: ['startup'] })];
    const results = findMatches('I just launched my startup today', keywords);
    expect(results).toHaveLength(1);
    expect(results[0].matchedPhrase).toBe('startup');
    expect(results[0].keywordId).toBe('kw-1');
  });

  it('matches multiple phrases in one keyword group', () => {
    const keywords = [makeKeyword({ phrases: ['saas', 'startup'] })];
    const results = findMatches('My saas startup is growing', keywords);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.matchedPhrase).sort()).toEqual(['saas', 'startup']);
  });

  it('matches across multiple keyword groups', () => {
    const keywords = [
      makeKeyword({ id: 'kw-1', phrases: ['saas'] }),
      makeKeyword({ id: 'kw-2', phrases: ['b2b'] }),
    ];
    const results = findMatches('Building a b2b saas product', keywords);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.keywordId).sort()).toEqual(['kw-1', 'kw-2']);
  });

  it('uses word boundary matching — does not match substrings', () => {
    const keywords = [makeKeyword({ phrases: ['app'] })];
    const results = findMatches('I love apples and happiness', keywords);
    expect(results).toHaveLength(0);
  });

  it('matches whole word even with surrounding punctuation', () => {
    const keywords = [makeKeyword({ phrases: ['saas'] })];
    const results = findMatches('Is this a saas? Yes!', keywords);
    expect(results).toHaveLength(1);
  });

  it('is case insensitive', () => {
    const keywords = [makeKeyword({ phrases: ['saas'] })];
    const results = findMatches('SaaS is the future', keywords);
    expect(results).toHaveLength(1);
  });

  it('respects exclusions', () => {
    const keywords = [makeKeyword({ phrases: ['startup'], exclusions: ['crypto'] })];
    const results = findMatches('My crypto startup failed', keywords);
    expect(results).toHaveLength(0);
  });

  it('matches when exclusion word is absent', () => {
    const keywords = [makeKeyword({ phrases: ['startup'], exclusions: ['crypto'] })];
    const results = findMatches('My tech startup is growing', keywords);
    expect(results).toHaveLength(1);
  });

  it('skips inactive keywords', () => {
    const keywords = [makeKeyword({ is_active: false })];
    const results = findMatches('This is about saas', keywords);
    expect(results).toHaveLength(0);
  });

  it('skips silenced keywords (future date)', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const keywords = [makeKeyword({ silenced_until: futureDate })];
    const results = findMatches('This is about saas', keywords);
    expect(results).toHaveLength(0);
  });

  it('matches expired silenced keywords (past date)', () => {
    const pastDate = new Date(Date.now() - 3_600_000).toISOString();
    const keywords = [makeKeyword({ silenced_until: pastDate })];
    const results = findMatches('This is about saas', keywords);
    expect(results).toHaveLength(1);
  });

  it('returns empty array when no matches', () => {
    const keywords = [makeKeyword({ phrases: ['blockchain'] })];
    const results = findMatches('I love building web apps', keywords);
    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty keywords list', () => {
    const results = findMatches('anything here', []);
    expect(results).toHaveLength(0);
  });

  it('handles multi-word phrases', () => {
    const keywords = [makeKeyword({ phrases: ['indie hacker'] })];
    const results = findMatches('Every indie hacker knows this', keywords);
    expect(results).toHaveLength(1);
  });

  it('handles special regex characters in phrases', () => {
    const keywords = [makeKeyword({ phrases: ['c++'] })];
    // c++ gets normalized to "c" by normalizeText (strips non-word chars)
    // This tests that the regex escaping doesn't crash
    const results = findMatches('I code in c++ daily', keywords);
    // Both "c++" and the text get normalized, so "c" matches "c"
    expect(results).toHaveLength(1);
  });
});
