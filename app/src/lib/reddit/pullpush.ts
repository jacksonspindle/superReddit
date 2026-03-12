/**
 * PullPush.io client for searching Reddit comments and posts.
 * PullPush indexes Reddit data and exposes a free search API,
 * enabling comment search that Reddit's public API doesn't support.
 */

import type { RedditPost } from '@/types';

const PULLPUSH_BASE = 'https://api.pullpush.io';

// ---- Rate Limiter (same pattern as fetcher.ts) ----
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillRatePerMinute: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerMinute / 60;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

const pullpushLimiter = new RateLimiter(15, 15); // 15 req/min (PullPush soft limit)

export interface PullPushComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  permalink: string;
  subreddit: string;
  parent_id: string;
  link_id: string; // parent post's fullname (t3_xxx)
}

interface PullPushCommentRaw {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  permalink?: string;
  subreddit: string;
  parent_id: string;
  link_id: string;
}

interface PullPushSubmissionRaw {
  id: string;
  title: string;
  selftext?: string;
  author: string;
  score: number;
  num_comments: number;
  url?: string;
  permalink?: string;
  created_utc: number;
  subreddit: string;
  link_flair_text?: string | null;
  is_self?: boolean;
  thumbnail?: string | null;
  post_hint?: string | null;
}

async function fetchFromPullPush(url: string): Promise<unknown> {
  await pullpushLimiter.acquire();

  console.log('[PullPush] Fetching:', url);
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  console.log('[PullPush] Response status:', response.status, 'for', url.split('?')[0]);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('PullPush rate limit exceeded. Please try again in a moment.');
    }
    throw new Error(`PullPush API error: ${response.status}`);
  }

  return response.json();
}

function parseComment(raw: PullPushCommentRaw): PullPushComment {
  return {
    id: raw.id,
    author: raw.author,
    body: raw.body || '',
    score: raw.score || 0,
    created_utc: raw.created_utc || 0,
    permalink: raw.permalink || `/r/${raw.subreddit}/comments/${raw.link_id?.replace('t3_', '')}/_/${raw.id}/`,
    subreddit: raw.subreddit,
    parent_id: raw.parent_id || '',
    link_id: raw.link_id || '',
  };
}

function parseSubmission(raw: PullPushSubmissionRaw): RedditPost {
  return {
    id: raw.id,
    title: raw.title || '',
    selftext: raw.selftext || '',
    author: raw.author || '',
    score: raw.score || 0,
    num_comments: raw.num_comments || 0,
    url: raw.url || '',
    permalink: raw.permalink || `/r/${raw.subreddit}/comments/${raw.id}/`,
    created_utc: raw.created_utc || 0,
    subreddit: raw.subreddit || '',
    link_flair_text: raw.link_flair_text || null,
    is_self: raw.is_self ?? true,
    thumbnail: raw.thumbnail || null,
    preview_url: null,
    post_hint: raw.post_hint || null,
  };
}

export async function searchComments(options: {
  subreddits: string[];
  query: string;
  after?: number;  // Unix timestamp
  before?: number; // Unix timestamp
  limit?: number;  // default 100, max 100
  sort?: 'asc' | 'desc';
}): Promise<PullPushComment[]> {
  const { subreddits, query, after, before, limit = 100, sort = 'desc' } = options;

  if (!query || subreddits.length === 0) return [];

  const params = new URLSearchParams({
    q: query,
    size: String(Math.min(limit, 100)),
    sort: 'created_utc',
    sort_type: sort,
  });
  for (const sub of subreddits) {
    params.append('subreddit', sub);
  }

  if (after) params.set('after', String(after));
  if (before) params.set('before', String(before));

  try {
    const url = `${PULLPUSH_BASE}/reddit/search/comment/?${params.toString()}`;
    const json = (await fetchFromPullPush(url)) as { data?: PullPushCommentRaw[] };
    const data = json.data || [];

    return data
      .filter((c) => c.author && c.author !== '[deleted]' && c.body && c.body !== '[deleted]')
      .map(parseComment);
  } catch (error) {
    console.error('PullPush comment search error:', error);
    return [];
  }
}

/** Fetch recent posts from subreddits without keyword filtering (for browsing) */
export async function fetchRecentPosts(options: {
  subreddits: string[];
  after?: number;
  before?: number;
  limit?: number;
}): Promise<RedditPost[]> {
  const { subreddits, after, before, limit = 100 } = options;

  if (subreddits.length === 0) return [];

  const params = new URLSearchParams({
    size: String(Math.min(limit, 100)),
    sort: 'created_utc',
    sort_type: 'desc',
  });
  for (const sub of subreddits) {
    params.append('subreddit', sub);
  }

  if (after) params.set('after', String(after));
  if (before) params.set('before', String(before));

  try {
    const url = `${PULLPUSH_BASE}/reddit/search/submission/?${params.toString()}`;
    const json = (await fetchFromPullPush(url)) as { data?: PullPushSubmissionRaw[] };
    const data = json.data || [];

    return data
      .filter((p) => p.author && p.author !== '[deleted]')
      .map(parseSubmission);
  } catch (error) {
    console.error('PullPush recent posts error:', error);
    return [];
  }
}

export async function searchPosts(options: {
  subreddits: string[];
  query: string;
  after?: number;
  before?: number;
  limit?: number;
}): Promise<RedditPost[]> {
  const { subreddits, query, after, before, limit = 100 } = options;

  if (!query || subreddits.length === 0) return [];

  const params = new URLSearchParams({
    q: query,
    size: String(Math.min(limit, 100)),
    sort: 'created_utc',
    sort_type: 'desc',
  });
  for (const sub of subreddits) {
    params.append('subreddit', sub);
  }

  if (after) params.set('after', String(after));
  if (before) params.set('before', String(before));

  try {
    const url = `${PULLPUSH_BASE}/reddit/search/submission/?${params.toString()}`;
    const json = (await fetchFromPullPush(url)) as { data?: PullPushSubmissionRaw[] };
    const data = json.data || [];

    return data
      .filter((p) => p.author && p.author !== '[deleted]')
      .map(parseSubmission);
  } catch (error) {
    console.error('PullPush post search error:', error);
    return [];
  }
}
