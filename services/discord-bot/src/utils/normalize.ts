/**
 * Normalize text for keyword matching.
 * Lowercases, strips extra whitespace, removes special characters
 * while preserving word boundaries.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a subreddit name by stripping the r/ prefix and lowercasing.
 */
export function normalizeSubreddit(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^r\//, '');
}
