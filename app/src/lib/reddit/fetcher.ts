import type { RedditPost, RedditSubredditInfo, RedditApiResponse } from '@/types';

const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';
const REDDIT_BASE = 'https://old.reddit.com';

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

const rateLimiter = new RateLimiter(10, 10); // 10 tokens, refills 10/min (Reddit's actual public limit)

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
function extractPreviewUrl(data: Record<string, unknown>): string | null {
  try {
    const preview = data.preview as { images?: { source?: { url?: string } }[] } | undefined;
    const sourceUrl = preview?.images?.[0]?.source?.url;
    if (sourceUrl) {
      // Reddit HTML-encodes URLs in preview data
      return sourceUrl.replace(/&amp;/g, '&');
    }
  } catch {
    // ignore malformed preview data
  }
  return null;
}

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
    preview_url: extractPreviewUrl(data),
    post_hint: (data.post_hint as string) || null,
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
  limit: number = 25,
  after?: string
): Promise<RedditApiResponse> {
  const cacheKey = `posts:${subreddit}:${sort}:${timeFilter}:${limit}:${after || ''}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  try {
    const timeParam = sort === 'top' ? `&t=${timeFilter}` : '';
    const afterParam = after ? `&after=${after}` : '';
    const url = `${REDDIT_BASE}/r/${subreddit}/${sort}.json?limit=${limit}${timeParam}${afterParam}&raw_json=1`;
    const json = await fetchFromReddit(url) as { data: { children: Record<string, unknown>[]; after: string | null } };

    const posts = json.data.children.map(parseRedditPost);
    const result: RedditApiResponse = { posts, after: json.data.after };

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

// ---- Thread Comments Cache (shorter TTL for monitoring) ----
const commentCache = new Map<string, { data: ThreadComment[]; expiresAt: number }>();
const COMMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearCommentCache() {
  commentCache.clear();
}

interface ThreadComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  permalink: string;
  parent_id: string;
}

function flattenComments(children: Record<string, unknown>[]): ThreadComment[] {
  const results: ThreadComment[] = [];
  for (const child of children) {
    if ((child as { kind?: string }).kind !== 't1') continue;
    const data = child.data as Record<string, unknown>;
    if (!data || !data.author || data.author === '[deleted]') continue;

    results.push({
      id: data.name as string, // full thing ID e.g. "t1_abc123"
      author: data.author as string,
      body: (data.body as string) || '',
      score: (data.score as number) || 0,
      created_utc: (data.created_utc as number) || 0,
      permalink: (data.permalink as string) || '',
      parent_id: (data.parent_id as string) || '',
    });

    // Recurse into replies
    const replies = data.replies as { data?: { children?: Record<string, unknown>[] } } | undefined;
    if (replies?.data?.children) {
      results.push(...flattenComments(replies.data.children));
    }
  }
  return results;
}

export async function fetchThreadComments(permalink: string): Promise<ThreadComment[]> {
  const cacheKey = `comments:${permalink}`;
  const cached = commentCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) commentCache.delete(cacheKey);

  try {
    // Ensure permalink doesn't have trailing slash issues
    const cleanPermalink = permalink.endsWith('/') ? permalink.slice(0, -1) : permalink;
    const url = `${REDDIT_BASE}${cleanPermalink}.json?limit=200&sort=new&raw_json=1`;
    const json = await fetchFromReddit(url) as unknown[];

    // Reddit returns [post_listing, comments_listing]
    if (!Array.isArray(json) || json.length < 2) return [];

    const commentsListing = json[1] as { data?: { children?: Record<string, unknown>[] } };
    const children = commentsListing?.data?.children || [];
    const comments = flattenComments(children);

    commentCache.set(cacheKey, { data: comments, expiresAt: Date.now() + COMMENT_CACHE_TTL });
    return comments;
  } catch (error) {
    console.error('Failed to fetch thread comments:', error);
    return [];
  }
}

export async function fetchUserPosts(username: string, limit = 10): Promise<RedditPost[]> {
  // Strip leading u/ or /u/ from username
  const cleanUsername = username.replace(/^\/?u\//, '');
  const cacheKey = `userposts:${cleanUsername}:${limit}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached.posts;

  try {
    const url = `${REDDIT_BASE}/user/${cleanUsername}/submitted.json?limit=${limit}&sort=new&raw_json=1`;
    const json = await fetchFromReddit(url) as { data: { children: Record<string, unknown>[] } };

    const posts = json.data.children.map(parseRedditPost);

    setMemoryCache(cacheKey, { posts });
    return posts;
  } catch (error) {
    console.error('Failed to fetch user posts:', error);
    return [];
  }
}

/**
 * Paginated fetch of ALL user posts (up to Reddit's ~1000 cap).
 * No caching — data goes straight to DB via the caller.
 * `shouldStop(redditIds)` lets the caller halt early when hitting known posts.
 */
export async function fetchAllUserPosts(
  username: string,
  options?: { shouldStop?: (ids: string[]) => boolean; maxPages?: number }
): Promise<RedditPost[]> {
  const cleanUsername = username.replace(/^\/?u\//, '');
  const maxPages = options?.maxPages ?? 10;
  const allPosts: RedditPost[] = [];
  let after: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const afterParam = after ? `&after=${after}` : '';
    const url = `${REDDIT_BASE}/user/${cleanUsername}/submitted.json?limit=100&sort=new&raw_json=1${afterParam}`;

    let json: { data: { children: Record<string, unknown>[]; after: string | null } };
    try {
      json = await fetchFromReddit(url) as typeof json;
    } catch (error) {
      console.error(`fetchAllUserPosts page ${page} error:`, error);
      break;
    }

    const children = json.data?.children || [];
    if (children.length === 0) break;

    const pagePosts = children.map(parseRedditPost);
    allPosts.push(...pagePosts);

    // Let caller stop early (e.g. when hitting already-known posts)
    if (options?.shouldStop) {
      const pageIds = pagePosts.map((p) => p.id);
      if (options.shouldStop(pageIds)) break;
    }

    after = json.data.after;
    if (!after) break; // No more pages
  }

  return allPosts;
}

export async function searchRedditGlobal(
  query: string,
  sort: string = 'relevance',
  timeFilter: string = 'week',
  limit: number = 20
): Promise<RedditApiResponse> {
  const cacheKey = `globalsearch:${query}:${sort}:${timeFilter}:${limit}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${REDDIT_BASE}/search.json?q=${encodeURIComponent(query)}&sort=${sort}&t=${timeFilter}&limit=${limit}&raw_json=1`;
    const json = await fetchFromReddit(url) as { data: { children: Record<string, unknown>[] } };

    const posts = json.data.children.map(parseRedditPost);
    const result: RedditApiResponse = { posts };

    setMemoryCache(cacheKey, result);
    return result;
  } catch (error) {
    return { posts: [], error: (error as Error).message };
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

/**
 * Multi-subreddit search with OR-grouped keywords and pagination.
 * Drastically reduces API calls: instead of N subs x M keywords = NxM calls,
 * this batches subs (up to 25 per chunk) and groups keywords with OR (~10 per group),
 * resulting in ~2-4 API calls total for typical configurations.
 */
export async function searchMultiSubPosts(
  subreddits: string[],
  keywords: string[],
  options?: {
    timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    limit?: number;     // total results target (default 100)
    maxPages?: number;  // pagination depth (default 3)
  }
): Promise<RedditApiResponse> {
  const timeFilter = options?.timeFilter || 'week';
  const targetLimit = options?.limit || 100;
  const maxPages = options?.maxPages || 3;

  if (subreddits.length === 0 || keywords.length === 0) {
    return { posts: [] };
  }

  // Build OR-grouped keyword queries (max ~10 keywords per group)
  const keywordGroups = chunkArray(keywords, 10).map((group) =>
    group
      .map((kw) => (kw.includes(' ') ? `"${kw}"` : kw))
      .join(' OR ')
  );

  // Chunk subreddits (max 25 per multi-sub request for URL length safety)
  const subChunks = chunkArray(subreddits, 25);

  const allPosts = new Map<string, RedditPost>(); // deduplicate by post ID

  for (const subChunk of subChunks) {
    const multiSub = subChunk.join('+');

    for (const queryStr of keywordGroups) {
      // Check L1 memory cache first
      const cacheKey = `multisearch:${multiSub}:${queryStr}:${timeFilter}`;
      const cached = getFromMemoryCache(cacheKey);
      if (cached) {
        for (const post of cached.posts) {
          allPosts.set(post.id, post);
        }
        continue;
      }

      // Paginate through results
      const chunkPosts: RedditPost[] = [];
      let after: string | null = null;

      for (let page = 0; page < maxPages; page++) {
        try {
          const afterParam = after ? `&after=${after}` : '';
          const url = `${REDDIT_BASE}/r/${multiSub}/search.json?q=${encodeURIComponent(queryStr)}&restrict_sr=on&limit=100&sort=relevance&t=${timeFilter}&raw_json=1${afterParam}`;
          const json = (await fetchFromReddit(url)) as {
            data: { children: Record<string, unknown>[]; after: string | null };
          };

          const pagePosts = json.data.children.map(parseRedditPost);
          chunkPosts.push(...pagePosts);

          after = json.data.after;
          if (!after || chunkPosts.length >= targetLimit) break;
        } catch (error) {
          console.error('Multi-sub search page error:', error);
          break;
        }
      }

      // Cache this chunk's results
      if (chunkPosts.length > 0) {
        setMemoryCache(cacheKey, { posts: chunkPosts });
      }

      for (const post of chunkPosts) {
        allPosts.set(post.id, post);
      }

      // Early exit if we have enough results
      if (allPosts.size >= targetLimit) break;
    }

    if (allPosts.size >= targetLimit) break;
  }

  return { posts: Array.from(allPosts.values()).slice(0, targetLimit) };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
