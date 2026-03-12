/**
 * Reddit proxy configuration.
 * Routes Reddit and PullPush requests through an external proxy
 * to avoid datacenter IP blocks from Reddit.
 *
 * Set REDDIT_PROXY_URL in your environment (e.g., https://your-proxy.railway.app)
 * Set REDDIT_PROXY_SECRET to match the proxy's PROXY_SECRET env var.
 */

const PROXY_URL = process.env.REDDIT_PROXY_URL || '';
const PROXY_SECRET = process.env.REDDIT_PROXY_SECRET || '';

/** Whether the proxy is configured */
export function isProxyEnabled(): boolean {
  return PROXY_URL.length > 0;
}

/**
 * Build a proxied URL for Reddit requests.
 * /r/microsaas/new.json → {PROXY_URL}/reddit/r/microsaas/new.json
 */
export function proxyRedditUrl(path: string, query: string = ''): string {
  if (!PROXY_URL) return `https://old.reddit.com${path}${query}`;
  return `${PROXY_URL}/reddit${path}${query}`;
}

/**
 * Build a proxied URL for PullPush requests.
 * /reddit/search/submission/?q=... → {PROXY_URL}/pullpush/reddit/search/submission/?q=...
 */
export function proxyPullPushUrl(path: string, query: string = ''): string {
  if (!PROXY_URL) return `https://api.pullpush.io${path}${query}`;
  return `${PROXY_URL}/pullpush${path}${query}`;
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
