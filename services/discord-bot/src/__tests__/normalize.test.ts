import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeSubreddit } from '../utils/normalize.js';

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('strips special characters', () => {
    expect(normalizeText('hello! @world #test')).toBe('hello world test');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('handles mixed case with punctuation', () => {
    expect(normalizeText('SaaS-based B2B startup!')).toBe('saas based b2b startup');
  });

  it('preserves underscores and digits', () => {
    expect(normalizeText('my_var_123')).toBe('my_var_123');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(normalizeText('!@#$%^&*()')).toBe('');
  });
});

describe('normalizeSubreddit', () => {
  it('strips r/ prefix', () => {
    expect(normalizeSubreddit('r/entrepreneur')).toBe('entrepreneur');
  });

  it('lowercases the name', () => {
    expect(normalizeSubreddit('R/Entrepreneur')).toBe('entrepreneur');
  });

  it('handles name without prefix', () => {
    expect(normalizeSubreddit('entrepreneur')).toBe('entrepreneur');
  });

  it('trims whitespace', () => {
    expect(normalizeSubreddit('  r/startup  ')).toBe('startup');
  });

  it('handles just r/', () => {
    expect(normalizeSubreddit('r/')).toBe('');
  });
});
