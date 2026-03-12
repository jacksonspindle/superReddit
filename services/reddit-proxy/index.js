import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

const app = new Hono();

const REDDIT_BASE = "https://old.reddit.com";
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
      if (!origin) return "*"; // allow server-to-server (cron)
      if (ALLOWED_ORIGINS.length === 0) return origin; // no restriction if not configured
      return ALLOWED_ORIGINS.includes(origin) ? origin : null;
    },
  })
);

// Auth via shared secret
app.use("*", async (c, next) => {
  const secret = process.env.PROXY_SECRET;
  if (secret) {
    const provided =
      c.req.header("x-proxy-secret") ||
      c.req.query("secret");
    if (provided !== secret) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  await next();
});

// Rate limiter — simple token bucket
let tokens = 10;
const maxTokens = 10;
const refillRate = 10 / 60; // 10 per minute
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

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "reddit-proxy" }));

// Proxy: GET /reddit/* → old.reddit.com/*
app.get("/reddit/*", async (c) => {
  if (!acquireToken()) {
    return c.json({ error: "Rate limited, try again shortly" }, 429);
  }

  const path = c.req.path.replace(/^\/reddit/, "");
  const query = c.req.url.includes("?")
    ? c.req.url.slice(c.req.url.indexOf("?"))
    : "";
  const url = `${REDDIT_BASE}${path}${query}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return c.json(
        { error: `Reddit returned ${res.status}`, status: res.status },
        res.status
      );
    }

    const data = await res.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// Proxy: GET /pullpush/* → api.pullpush.io/*
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
