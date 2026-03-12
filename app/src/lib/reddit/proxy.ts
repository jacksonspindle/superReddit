/**
 * Reddit proxy configuration.
 * Routes requests through an external proxy on Railway to avoid
 * Reddit blocking datacenter IPs (Vercel, AWS, etc.).
 *
 * The proxy fetches Reddit RSS feeds and returns parsed JSON.
 *
 * Set REDDIT_PROXY_URL in your environment (e.g., https://reddit-proxy-v2-production.up.railway.app)
 * Set REDDIT_PROXY_SECRET to match the proxy's PROXY_SECRET env var.
 */

const PROXY_URL = process.env.REDDIT_PROXY_URL || '';
const PROXY_SECRET = process.env.REDDIT_PROXY_SECRET || '';

/** Whether the proxy is configured */
export function isProxyEnabled(): boolean {
  return PROXY_URL.length > 0;
}

/** Headers to include when calling the proxy */
export function proxyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (PROXY_SECRET) {
    headers['x-proxy-secret'] = PROXY_SECRET;
  }
  return headers;
}

/** Fetch recent posts from multiple subreddits via the proxy's RSS endpoint */
export async function proxyFetchMultiSub(
  subreddits: string[],
  sort: 'new' | 'hot' | 'top' | 'rising' = 'new',
  limit: number = 100
): Promise<{ posts: ProxyPost[]; errors?: string[] }> {
  if (!PROXY_URL) throw new Error('REDDIT_PROXY_URL is not configured');

  const url = `${PROXY_URL}/rss-multi?subs=${subreddits.join(',')}&sort=${sort}&limit=${limit}`;
  const res = await fetch(url, { headers: proxyHeaders(), cache: 'no-store' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `Proxy returned ${res.status}`);
  }

  return res.json();
}

/** Search a subreddit via the proxy's RSS search endpoint */
export async function proxySearchSub(
  subreddit: string,
  query: string,
  timeFilter: string = 'week',
  sort: string = 'relevance',
  limit: number = 100
): Promise<{ posts: ProxyPost[]; errors?: string[] }> {
  if (!PROXY_URL) throw new Error('REDDIT_PROXY_URL is not configured');

  const url = `${PROXY_URL}/rss-search/${subreddit}?q=${encodeURIComponent(query)}&t=${timeFilter}&sort=${sort}&limit=${limit}`;
  const res = await fetch(url, { headers: proxyHeaders(), cache: 'no-store' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `Proxy returned ${res.status}`);
  }

  return res.json();
}

/** Build a proxied URL for PullPush requests (comment search only) */
export function proxyPullPushUrl(path: string, query: string = ''): string {
  if (!PROXY_URL) return `https://api.pullpush.io${path}${query}`;
  return `${PROXY_URL}/pullpush${path}${query}`;
}

/** Post shape returned by the proxy RSS endpoints */
export interface ProxyPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  url: string;
  subreddit: string;
  created_utc: number;
  score: number;
  num_comments: number;
  link_flair_text: string | null;
  is_self: boolean;
  thumbnail: string | null;
  preview_url: string | null;
  post_hint: string | null;
}
