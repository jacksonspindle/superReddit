---
tags:
  - competitor/superx
  - technical
  - chrome-extension
aliases:
  - SuperX Tech Stack
  - SuperX Architecture
date: 2026-02-07
category: competitor-analysis
status: reference
---

# SuperX (superx.so) - Technical Analysis

This document covers the technical architecture behind the features described in [[product-analysis]].

## 1. Tech Stack

### Marketing Website (superx.so)
- **Platform**: Framer (no-code website builder)
- **Styling**: Custom CSS with Framer design system
- **Fonts**: Inter (primary), Instrument Serif (accent), loaded from Google Fonts and Framer CDN
- **CDN**: framerusercontent.com for assets
- **Analytics**: Google Analytics 4 (GA-X1LTT5GNL2)

### Web Application (app.superx.so)
- **Framework**: Next.js (React-based) -- confirmed by `__next_f` streaming format, RSC payload structure, and `/_next/static/` chunk serving
- **UI Library**: React with Server Components (RSC)
- **Styling**: Tailwind CSS (utility-first classes like `bg-slate-50/50`, `dark:bg-slate-100/5`)
- **Dark Mode**: Supported natively
- **PWA Support**: Has `/manifest.webmanifest` indicating Progressive Web App capabilities
- **Hosting**: Vercel (serverless deployment, standard for Next.js apps)
- **CDN/Security**: Cloudflare for DDoS protection and CDN

### Chrome Extension
- **Extension ID**: `bjobgelaoehgbnklgcaaehdpckmhkplk`
- **Manifest Version**: V3 (modern Chrome extension format)
- **Likely built with**: TypeScript/React (Rob Hallam has TypeScript Chrome extension experience -- see his `pentestlist-chrome` repo on GitHub)
- **Permissions**: Minimal -- reads data visible on twitter.com, uses official OAuth flow
- **Key permissions likely include**: `tabs`, `storage`, `https://api.twitter.com/*`

This extension architecture influenced the approach explored in [[chrome-extension-dm-bridge]] for SuperReddit's own extension design.

### Development Tools
- **AI-Assisted Development**: Rob Hallam initially used **Cursor AI** for development, then switched to **Claude Code** (Anthropic), citing it as "way better at following instructions" with "$1000s of API credits for just $100-200/month"
- **Version Control**: GitHub (Rob's GitHub: github.com/robj3d3)

### Tracking & Analytics (on the product)
- **Google Analytics 4**: `G-X1LTT5GNL2`
- **Facebook Pixel**: `1845877739652846` (conversion tracking)
- **Rewardful**: Affiliate/referral tracking system

---

## 2. Twitter/X API Usage

### Authentication
- **OAuth Flow**: Uses official Twitter/X OAuth for user authentication
- **Privacy-Focused**: Only reads data users already see on twitter.com; never posts without permission

### Data Access
- **Timeline Ingestion**: Ingests historical tweets from user timelines for AI training/tone analysis
- **Metrics Tracked**: Followers, Posts, Impressions, Engagements, Likes, Retweets, Replies, Bookmarks
- **Public Profile Analytics**: Can analyze any public X profile (used for the /creators/ pages)
- **Real-time Updates**: Analytics update in real-time

### Likely API Endpoints Used
- **GET /2/users/:id/tweets** -- User tweet history for AI tone learning
- **GET /2/tweets/:id** -- Individual tweet metrics
- **GET /2/users/:id/followers** -- Follower tracking
- **GET /2/users/:id** -- Profile data and public metrics
- **POST /2/tweets** -- Posting/scheduling tweets (with user permission)
- **DELETE /2/tweets/:id** -- Auto-delete feature for low-engagement posts
- **Engagement metrics endpoints** -- For impressions, likes, retweets, replies, bookmarks

### Rate Limit Considerations
- Twitter API v2 rate limits vary by access tier (Basic: $100/mo, Pro: $5000/mo)
- The Chrome extension reading on-page data may reduce API call dependency (scraping visible data from the DOM rather than making separate API calls)
- Likely uses a combination of direct API calls for write operations and DOM scraping for read operations to stay within rate limits

---

## 3. Architecture

### Two-Component System
SuperX operates as a **Chrome Extension + Web Application** combination:

```
+-------------------+       +-------------------+       +------------------+
|  Chrome Extension |<----->|  SuperX Backend   |<----->|  Web App         |
|  (sidebar on X)   |       |  (Next.js/Vercel) |       |  (app.superx.so) |
+-------------------+       +-------------------+       +------------------+
        |                           |                           |
        v                           v                           v
  twitter.com DOM            Twitter API v2              Analytics Dashboard
  (reads visible data)      (read/write ops)            (charts, metrics)
```

### Chrome Extension Architecture
- Injects as a **sidebar overlay** on twitter.com
- Provides real-time analytics without leaving the timeline
- Features: AI writer, thread writer, scheduler, auto-retweet, content library
- Described as "central to the experience" -- the primary interface for most users
- Lightweight: operates within twitter.com, no separate window needed

### Web Application Architecture
- **app.superx.so**: Full dashboard for deeper analytics
- Built with Next.js using React Server Components for performance
- Features GitHub-style contribution heatmap visualizations
- Time-range selectors, engagement charts, follower tracking
- Serves as the complementary deep-analytics platform to the extension

### Data Flow
1. User authenticates via Twitter OAuth (both in extension and web app)
2. Extension reads on-page Twitter data + makes API calls for additional metrics
3. Data synced to SuperX backend
4. AI models process tweet history to learn user tone/style
5. Web app displays aggregated analytics, trends, and AI-generated content suggestions

---

## 4. Data Storage

### Likely Database Architecture
- **Primary Database**: Not publicly confirmed, but given Next.js/Vercel stack, likely one of:
  - **Supabase (PostgreSQL)** -- Most common with Vercel/Next.js indie hacker stacks
  - **PlanetScale (MySQL)** -- Popular serverless DB for Vercel deployments
  - **Neon (PostgreSQL)** -- Another Vercel-friendly serverless Postgres option
- **Caching**: Likely Redis or Vercel KV for real-time analytics caching
- **File/Asset Storage**: Vercel Blob or AWS S3 for user-generated content

### Data Stored
- User authentication tokens (OAuth)
- Tweet history and engagement metrics over time
- AI model training data (user writing patterns/tone)
- Scheduled posts and drafts
- Analytics snapshots and historical trends
- Follower growth data points
- User preferences and settings

### Privacy Approach
- Claims to never sell user information
- Only reads data already visible on twitter.com
- Uses official OAuth (not scraping credentials)

---

## 5. AI Features

### AI Writing Assistant
- **AI Chat Mode**: Learns user's writing tone and style from historical tweets
- **AI Writer**: Generates high-quality tweet drafts matching user's voice
- **Rewrite with AI**: Creates multiple variations of existing content
- **Thread Writer**: AI-powered thread composition

### AI Analytics
- **Algorithm Simulator**: Predicts tweet performance before posting
- **Advanced Inspiration Engine**: Scans trending content for content ideas
- **Optimal Posting Times**: Data-driven scheduling recommendations
- **Content Performance Analysis**: Identifies which content types resonate most

### AI Models/APIs
- **Initially built with Cursor AI** for model training and tone analysis
- **Likely uses OpenAI GPT-4/Claude API** for text generation (not confirmed specifically, but standard for this category)
- **Personalization Pipeline**:
  1. Ingests user's historical tweets
  2. Analyzes writing patterns, vocabulary, tone
  3. Fine-tunes/prompts AI model with user's style profile
  4. Generates content that matches the user's voice
  5. Iterative feedback loop for refinement

### Content Library
- **SuperX Library**: Database of 10M+ viral posts searchable by topic
- **Trending Content Scanner**: Identifies trending topics and content patterns

---

## 6. Founder Background

### Rob Hallam (@robj3d3)
- **Role**: Founder & Solo Developer of SuperX
- **Title**: Software Engineer
- **Education**: University of Birmingham
- **Location**: Based in Worcester, UK (travels extensively while building)
- **Website**: robhallam.com
- **GitHub**: github.com/robj3d3 (16 repositories)
- **LinkedIn**: linkedin.com/in/roberthallam

### Technical Background
- Self-described as Developer, Innovator, Programmer, Builder
- Languages: Python, JavaScript, TypeScript, HTML
- Experience with Chrome extensions (built `pentestlist-chrome` in TypeScript)
- Security background (built phishing detection tools, pentestlist.com)
- Game development (covidcatch with pygame, quantCasino)
- Article notes he had "zero coding background in machine learning" before building SuperX's AI features
- Heavily uses AI-assisted development (Cursor, then Claude Code)

### Other Projects
- **Liftoff** -- product details unknown
- **Indiedex.app** -- indie hacker directory
- **Pentestlist.com** -- security tool
- Active on Indiedex community

### Building Style
- Solo founder, no co-founder or team mentioned
- Ships rapidly, builds in public on X -- a strategy analyzed in detail in [[growth-strategy]]
- Uses AI tools extensively for development acceleration
- Product-led growth approach (no marketing spend initially)

---

## 7. Development Timeline

### Key Milestones

| Date (Approximate) | Event |
|---|---|
| ~Early 2025 | SuperX initial development begins |
| ~Mid 2025 | Chrome extension launches |
| ~Mid 2025 | Hit $1k MRR with Chrome extension only, no marketing |
| ~Mid 2025 | Hit $2k MRR; Rob hospitalized from stress/overwork |
| Jul 31, 2025 | Featured in SaaS Strats interview with founder |
| ~Late 2025 | Day 12 of "$10k MRR" growth challenge |
| ~Late 2025 | Crossed $13k MRR (noted by Travis Fischer) |
| ~Late 2025/Early 2026 | Hit $19k/month, then $25k/month |
| ~2026 (current) | Building toward $100k/month goal; currently ~$16-25k MRR |

### Growth Trajectory
- Started Chrome extension only, grew purely through product quality
- Zero marketing spend initially -- product-led growth
- Rapid MRR scaling: $1k -> $2k -> $13k -> $19k -> $25k over ~6-8 months
- Publicly building and sharing journey on X, which itself drives organic growth
- Travis Fischer endorsement: "just on an insane growth trajectory"

---

## 8. Infrastructure

### Hosting & Deployment
- **Web App Hosting**: Vercel (serverless, edge-optimized)
- **Marketing Site**: Framer (managed hosting)
- **CDN**: Cloudflare (DDoS protection + content delivery)
- **Chrome Extension**: Chrome Web Store distribution

### Third-Party Services
- **Google Analytics 4**: User behavior tracking
- **Facebook Pixel**: Ad conversion tracking / retargeting
- **Rewardful**: Affiliate program management
- **Twitter/X API**: Core data source
- **Bluesky API**: Cross-posting support

### Scalability Architecture
- **Serverless**: Vercel's serverless functions scale automatically
- **Edge Functions**: Next.js RSC with edge rendering for low-latency
- **Cloudflare**: Global CDN for static assets and API caching
- **PWA**: Progressive Web App support for mobile-like experience

### Cost Structure (Estimated)
- Vercel Pro: ~$20/month
- Twitter API (Basic or Pro tier): $100-$5,000/month
- AI API costs (OpenAI/Anthropic): Variable, likely $500-2,000/month at current scale
- Cloudflare: Free-$20/month
- Database hosting: $25-100/month
- Domain + misc: ~$20/month

---

## 9. Key Technical Takeaways for SuperReddit

These technical learnings feed directly into the [[SUPERREDDIT-PRODUCT-CONCEPT]] architecture decisions.

### What We Can Learn from SuperX's Architecture

1. **Chrome Extension + Web App Combo**: The extension is the primary interface (embedded in X.com), while the web app serves deeper analytics. This same pattern could work for Reddit (extension on reddit.com + web dashboard).

2. **Next.js + Vercel Stack**: Battle-tested, scalable, and fast to develop on. Perfect for a solo founder or small team.

3. **AI-Assisted Development**: Rob built this largely with AI coding tools (Cursor, Claude Code). This enables a solo developer to build and maintain a complex SaaS product.

4. **DOM Scraping + API Hybrid**: Reading visible data from the page reduces API costs and rate limit pressure. Essential for staying within Reddit API limits -- a challenge explored extensively in [[reddit-without-api-approaches]].

5. **Framer for Marketing**: Separating the marketing site (Framer) from the app (Next.js) allows rapid marketing iteration without touching the codebase.

6. **Product-Led Growth**: $1k MRR with zero marketing spend, purely from the Chrome extension's value. Building something genuinely useful on the platform itself drives organic growth.

7. **Tailwind CSS**: Fast UI development with consistent design system, especially important for solo founders.

8. **Progressive Enhancement**: Start with Chrome extension (lower barrier), expand to full web app as features grow.

---

## Sources
- superx.so (website source analysis)
- app.superx.so/analytics (web app source analysis)
- Chrome Web Store listing
- prompttoproducthub.com - "How Rob Hallam Built SuperX"
- SaaS Strats - "The only tool you need to grow on X" (Jul 2025)
- Rob Hallam's GitHub (github.com/robj3d3)
- Rob Hallam's X (@robj3d3) posts
- Travis Fischer's endorsement tweet
- chrome-stats.com extension analysis
- toolai.io/ai/superx
- brandled.app/blog/superx-alternatives
- eliteai.tools/tool/superx
