import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

const app = new Hono();

const REDDIT_BASE = "https://www.reddit.com";
const USER_AGENT =
  "web:superreddit-proxy:v1.0.0 (by /u/superreddit_app)";

// Only allow requests from your Vercel app
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (ALLOWED_ORIGINS.length === 0) return origin;
      return ALLOWED_ORIGINS.includes(origin) ? origin : null;
    },
  })
);

// Auth via shared secret
app.use("*", async (c, next) => {
  const secret = process.env.PROXY_SECRET;
  if (secret) {
    const provided =
      c.req.header("x-proxy-secret") || c.req.query("secret");
    if (provided !== secret) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  await next();
});

// Rate limiter — token bucket
let tokens = 15;
const maxTokens = 15;
const refillRate = 15 / 60; // 15 per minute
let lastRefill = Date.now();

function acquireToken() {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  tokens = Math.min(maxTokens, tokens + elapsed * refillRate);
  lastRefill = now;
  if (tokens < 1) return false;
  tokens -= 1;
  return true;
}

// ---- RSS XML Parser (no dependencies) ----

function extractBetween(xml, tag) {
  const results = [];
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  let idx = 0;
  while (true) {
    const start = xml.indexOf(openTag, idx);
    if (start === -1) break;
    const contentStart = start + openTag.length;
    const end = xml.indexOf(closeTag, contentStart);
    if (end === -1) break;
    results.push(xml.slice(contentStart, end));
    idx = end + closeTag.length;
  }
  return results;
}

function getTagContent(xml, tag) {
  // Handle both <tag>content</tag> and <tag><![CDATA[content]]></tag>
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`)
  );
  return match ? match[1].trim() : "";
}

function getAttr(xml, tag, attr) {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/?>`, 's'));
  return match ? match[1] : "";
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseRssToJson(xml) {
  const items = extractBetween(xml, "entry").length > 0
    ? extractBetween(xml, "entry")  // Atom feed
    : extractBetween(xml, "item");   // RSS feed

  return items.map((item) => {
    // Reddit RSS uses Atom format with <entry> tags
    const title = decodeHtmlEntities(getTagContent(item, "title"));
    const link = getAttr(item, "link", "href") || getTagContent(item, "link");
    const content = decodeHtmlEntities(getTagContent(item, "content"));
    const author = getTagContent(item, "name") || getTagContent(item, "author");
    const published = getTagContent(item, "published") || getTagContent(item, "updated") || getTagContent(item, "pubDate");
    const id = getTagContent(item, "id") || link;
    const category = getTagContent(item, "category");

    // Extract subreddit and post ID from the link
    // Link format: https://www.reddit.com/r/microsaas/comments/abc123/title_slug/
    const linkMatch = link.match(/\/r\/([^/]+)\/comments\/([^/]+)/);
    const subreddit = linkMatch ? linkMatch[1] : "";
    const postId = linkMatch ? linkMatch[2] : "";

    // Extract selftext from HTML content
    // Reddit wraps it in a <div> with <!-- SC_OFF --> markers
    let selftext = "";
    if (content) {
      // Try to extract text content from HTML
      const mdMatch = content.match(/<!-- SC_OFF --><div class="md">([\s\S]*?)<\/div><!-- SC_ON -->/);
      if (mdMatch) {
        selftext = mdMatch[1]
          .replace(/<[^>]+>/g, " ")  // strip HTML tags
          .replace(/\s+/g, " ")      // collapse whitespace
          .trim();
      }
    }

    // Parse permalink from link
    const permalink = link.replace("https://www.reddit.com", "");

    return {
      id: postId,
      title,
      selftext: decodeHtmlEntities(selftext),
      author: author.replace(/^\/u\//, ""),
      permalink,
      url: link,
      subreddit,
      created_utc: published ? Math.floor(new Date(published).getTime() / 1000) : 0,
      score: 0,           // RSS doesn't include score
      num_comments: 0,    // RSS doesn't include comment count
      link_flair_text: category || null,
      is_self: true,
      thumbnail: null,
      preview_url: null,
      post_hint: null,
    };
  }).filter((p) => p.id && p.subreddit);
}

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "reddit-proxy", version: "2.0.0-rss" }));

/**
 * GET /rss/:subreddit
 * Fetches RSS feed for a subreddit and returns parsed JSON posts.
 * Query params:
 *   sort: hot|new|top|rising (default: new)
 *   limit: number of posts (default: 25, max depends on Reddit)
 *   after: pagination token
 */
app.get("/rss/:subreddit", async (c) => {
  if (!acquireToken()) {
    return c.json({ error: "Rate limited, try again shortly" }, 429);
  }

  const subreddit = c.req.param("subreddit");
  const sort = c.req.query("sort") || "new";
  const limit = c.req.query("limit") || "100";
  const after = c.req.query("after") || "";

  let url = `${REDDIT_BASE}/r/${subreddit}/${sort}/.rss?limit=${limit}`;
  if (after) url += `&after=${after}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!res.ok) {
      return c.json(
        { error: `Reddit returned ${res.status}`, status: res.status },
        res.status
      );
    }

    const xml = await res.text();
    const posts = parseRssToJson(xml);

    return c.json({ posts, count: posts.length });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

/**
 * GET /rss-multi
 * Fetches RSS feeds for multiple subreddits in parallel.
 * Query params:
 *   subs: comma-separated subreddit names
 *   sort: hot|new|top|rising (default: new)
 *   limit: per-subreddit limit (default: 100)
 */
app.get("/rss-multi", async (c) => {
  const subsParam = c.req.query("subs") || "";
  const sort = c.req.query("sort") || "new";
  const limit = c.req.query("limit") || "100";

  const subreddits = subsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (subreddits.length === 0) {
    return c.json({ error: "No subreddits provided" }, 400);
  }

  // Also try multi-sub feed: r/sub1+sub2+sub3
  const allPosts = new Map();
  const errors = [];

  // Fetch multi-sub RSS first (one request for all subs)
  const multiSub = subreddits.slice(0, 25).join("+");
  if (acquireToken()) {
    try {
      const url = `${REDDIT_BASE}/r/${multiSub}/${sort}/.rss?limit=${limit}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });

      if (res.ok) {
        const xml = await res.text();
        const posts = parseRssToJson(xml);
        for (const post of posts) {
          if (!allPosts.has(post.id)) {
            allPosts.set(post.id, post);
          }
        }
      } else {
        errors.push(`Multi-sub RSS returned ${res.status}`);
      }
    } catch (err) {
      errors.push(`Multi-sub RSS failed: ${err.message}`);
    }
  }

  // If multi-sub returned few results, fetch individual subs too
  if (allPosts.size < 10) {
    const fetches = subreddits.map(async (sub) => {
      if (!acquireToken()) {
        errors.push(`Rate limited for r/${sub}`);
        return;
      }
      try {
        const url = `${REDDIT_BASE}/r/${sub}/${sort}/.rss?limit=${limit}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/rss+xml, application/xml, text/xml",
          },
        });

        if (res.ok) {
          const xml = await res.text();
          const posts = parseRssToJson(xml);
          for (const post of posts) {
            if (!allPosts.has(post.id)) {
              allPosts.set(post.id, post);
            }
          }
        } else {
          errors.push(`r/${sub} RSS returned ${res.status}`);
        }
      } catch (err) {
        errors.push(`r/${sub} RSS failed: ${err.message}`);
      }
    });

    await Promise.all(fetches);
  }

  const posts = Array.from(allPosts.values()).sort(
    (a, b) => b.created_utc - a.created_utc
  );

  return c.json({
    posts,
    count: posts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});

/**
 * GET /rss-search/:subreddit
 * Searches a subreddit via RSS (Reddit supports search RSS feeds).
 * Query params:
 *   q: search query
 *   sort: relevance|new|top (default: relevance)
 *   t: hour|day|week|month|year|all (default: week)
 *   limit: max results
 */
app.get("/rss-search/:subreddit", async (c) => {
  if (!acquireToken()) {
    return c.json({ error: "Rate limited, try again shortly" }, 429);
  }

  const subreddit = c.req.param("subreddit");
  const query = c.req.query("q") || "";
  const sort = c.req.query("sort") || "relevance";
  const timeFilter = c.req.query("t") || "week";
  const limit = c.req.query("limit") || "100";

  if (!query) {
    return c.json({ error: "Search query required" }, 400);
  }

  const url = `${REDDIT_BASE}/r/${subreddit}/search/.rss?q=${encodeURIComponent(query)}&restrict_sr=on&sort=${sort}&t=${timeFilter}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!res.ok) {
      return c.json(
        { error: `Reddit search returned ${res.status}`, status: res.status },
        res.status
      );
    }

    const xml = await res.text();
    const posts = parseRssToJson(xml);

    return c.json({ posts, count: posts.length });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// Keep PullPush proxy for comment search
app.get("/pullpush/*", async (c) => {
  if (!acquireToken()) {
    return c.json({ error: "Rate limited, try again shortly" }, 429);
  }

  const path = c.req.path.replace(/^\/pullpush/, "");
  const query = c.req.url.includes("?")
    ? c.req.url.slice(c.req.url.indexOf("?"))
    : "";
  const url = `https://api.pullpush.io${path}${query}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return c.json(
        { error: `PullPush returned ${res.status}`, status: res.status },
        res.status
      );
    }

    const data = await res.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

const port = parseInt(process.env.PORT || "3001", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Reddit proxy running on port ${port}`);
});
