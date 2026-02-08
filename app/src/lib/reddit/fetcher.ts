import type { RedditPost, RedditSubredditInfo, RedditApiResponse } from '@/types';

const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';
const REDDIT_BASE = 'https://www.reddit.com';

// ---- Rate Limiter (Token Bucket) ----
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
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
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
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

const rateLimiter = new RateLimiter(8, 8); // 8 tokens, refills 8/min

// ---- In-Memory Cache ----
const memoryCache = new Map<string, { data: RedditApiResponse; expiresAt: number }>();
const MEMORY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getFromMemoryCache(key: string): RedditApiResponse | null {
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  if (entry) memoryCache.delete(key);
  return null;
}

function setMemoryCache(key: string, data: RedditApiResponse) {
  memoryCache.set(key, { data, expiresAt: Date.now() + MEMORY_CACHE_TTL });
}

// ---- Parser ----
function parseRedditPost(raw: Record<string, unknown>): RedditPost {
  const data = raw.data as Record<string, unknown>;
  return {
    id: data.id as string,
    title: data.title as string,
    selftext: (data.selftext as string) || '',
    author: data.author as string,
    score: data.score as number,
    num_comments: data.num_comments as number,
    url: data.url as string,
    permalink: data.permalink as string,
    created_utc: data.created_utc as number,
    subreddit: data.subreddit as string,
    link_flair_text: (data.link_flair_text as string) || null,
    is_self: data.is_self as boolean,
    thumbnail: (data.thumbnail as string) || null,
  };
}

function parseSubredditInfo(data: Record<string, unknown>): RedditSubredditInfo {
  const d = data.data as Record<string, unknown>;
  return {
    name: d.display_name as string,
    title: d.title as string,
    subscribers: d.subscribers as number,
    active_user_count: (d.active_user_count as number) || null,
    public_description: (d.public_description as string) || '',
    description: (d.description as string) || '',
    icon_img: (d.icon_img as string) || null,
    banner_background_image: (d.banner_background_image as string) || null,
  };
}

// ---- Fetcher ----
async function fetchFromReddit(url: string): Promise<unknown> {
  await rateLimiter.acquire();

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Reddit rate limit exceeded. Please try again in a moment.');
    }
    if (response.status === 403) {
      throw new Error('This subreddit is private or banned.');
    }
    if (response.status === 404) {
      throw new Error('Subreddit not found.');
    }
    throw new Error(`Reddit API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchSubredditPosts(
  subreddit: string,
  sort: 'hot' | 'top' | 'rising' | 'new' = 'hot',
  timeFilter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'week',
  limit: number = 25
): Promise<RedditApiResponse> {
  const cacheKey = `posts:${subreddit}:${sort}:${timeFilter}:${limit}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  try {
    const timeParam = sort === 'top' ? `&t=${timeFilter}` : '';
    const url = `${REDDIT_BASE}/r/${subreddit}/${sort}.json?limit=${limit}${timeParam}&raw_json=1`;
    const json = await fetchFromReddit(url) as { data: { children: Record<string, unknown>[] } };

    const posts = json.data.children.map(parseRedditPost);
    const result: RedditApiResponse = { posts };

    setMemoryCache(cacheKey, result);
    return result;
  } catch (error) {
    return { posts: [], error: (error as Error).message };
  }
}

export async function fetchSubredditInfo(subreddit: string): Promise<RedditSubredditInfo | null> {
  const cacheKey = `info:${subreddit}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached && cached.subredditInfo) return cached.subredditInfo;

  try {
    const url = `${REDDIT_BASE}/r/${subreddit}/about.json`;
    const json = await fetchFromReddit(url) as Record<string, unknown>;
    const info = parseSubredditInfo(json);

    setMemoryCache(cacheKey, { posts: [], subredditInfo: info });
    return info;
  } catch {
    return null;
  }
}

export async function searchSubredditPosts(
  subreddit: string,
  query: string,
  limit: number = 25
): Promise<RedditApiResponse> {
  const cacheKey = `search:${subreddit}:${query}:${limit}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${REDDIT_BASE}/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&limit=${limit}&sort=top&t=year&raw_json=1`;
    const json = await fetchFromReddit(url) as { data: { children: Record<string, unknown>[] } };

    const posts = json.data.children.map(parseRedditPost);
    const result: RedditApiResponse = { posts };

    setMemoryCache(cacheKey, result);
    return result;
  } catch (error) {
    return { posts: [], error: (error as Error).message };
  }
}
