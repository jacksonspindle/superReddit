# SuperReddit

AI-powered Reddit marketing platform that helps product creators find the right subreddits, generate authentic posts, discover high-intent signals, manage outreach pipelines, and automate DM workflows — all from one dashboard.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Features](#features)
  - [Project Management](#project-management)
  - [AI Content Generation](#ai-content-generation)
  - [AI Chat Assistant](#ai-chat-assistant)
  - [Reddit Integration](#reddit-integration)
  - [Signal Detection & Outreach](#signal-detection--outreach)
  - [DM Pipeline](#dm-pipeline)
  - [Chrome Extension](#chrome-extension)
  - [Multi-Channel Alerts](#multi-channel-alerts)
  - [Dashboard & Analytics](#dashboard--analytics)
  - [GitHub Context](#github-context)
- [API Routes](#api-routes)
- [Chrome Extension](#chrome-extension-1)
- [Architecture](#architecture)

---

## Overview

SuperReddit is a full-stack platform for Reddit-native marketing. It combines:

1. **AI content generation** — Claude Sonnet 4.5 generates authentic Reddit posts using 10+ writing styles (Struggle & Discovery, PSA Drop, Builder's Showcase, etc.)
2. **Signal detection** — Scans subreddits for high-intent posts where your product is a natural fit, scoring them on relevance, intent, and conversion potential
3. **Outreach pipeline** — Kanban-style pipeline to manage leads from discovery through reply to conversion
4. **DM automation** — Chrome extension that bridges Reddit chat with the platform for bulk DM outreach
5. **Multi-channel alerts** — Get notified about new signals via Email, Telegram, Discord, or Slack

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, TypeScript, Turbopack) |
| UI | Tailwind CSS v4 + shadcn/ui (new-york style) + Radix UI |
| State | Zustand |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| AI | Anthropic Claude API (Sonnet 4.5) |
| Email | Resend |
| Charts | Recharts |
| Animations | Motion (Framer Motion) |
| Markdown | react-markdown + remark-gfm |
| Browser Extension | Chrome Manifest V3 (vanilla JS) |

## Project Structure

```
superReddit/
├── app/                          # Next.js application
│   ├── src/
│   │   ├── app/                  # App Router pages & API routes
│   │   │   ├── (auth)/           # Auth group (login, signup)
│   │   │   ├── api/              # 50+ API routes
│   │   │   ├── onboarding/       # First-time onboarding flow
│   │   │   └── projects/         # Project pages
│   │   │       ├── [id]/         # Dynamic project routes
│   │   │       │   ├── ai-writer/
│   │   │       │   ├── bookmarks/
│   │   │       │   ├── chat/
│   │   │       │   ├── context/
│   │   │       │   ├── create/
│   │   │       │   ├── daily-mix/
│   │   │       │   ├── dms/
│   │   │       │   ├── drafts/
│   │   │       │   ├── inspiration/
│   │   │       │   ├── outreach/
│   │   │       │   └── subreddits/
│   │   │       └── new/          # New project wizard
│   │   ├── components/
│   │   │   ├── chat/             # AI chat interface
│   │   │   ├── create/           # Post editor & reference sidebar
│   │   │   ├── dashboard/        # Stats, heatmap, analytics
│   │   │   ├── inspiration/      # Post discovery cards
│   │   │   ├── layout/           # Header, sidebar
│   │   │   ├── motion/           # Animation wrappers
│   │   │   ├── onboarding/       # Onboarding steps
│   │   │   ├── outreach/         # Signals, DMs, alerts, keywords
│   │   │   ├── pipeline/         # Kanban board components
│   │   │   ├── profile/          # Avatar upload
│   │   │   └── ui/               # shadcn/ui primitives
│   │   ├── lib/
│   │   │   ├── ai/               # Anthropic client + 13 prompt builders
│   │   │   ├── data/             # Writing styles data
│   │   │   ├── outreach/         # Signal scoring, compliance, DM templates
│   │   │   ├── reddit/           # Fetcher, cache, keyword discovery
│   │   │   └── supabase/         # Client, server, middleware helpers
│   │   ├── stores/               # Zustand stores
│   │   └── types/                # TypeScript type definitions
│   └── supabase/
│       └── migrations/           # 16 SQL migration files
├── extension/                    # Chrome extension (SuperReddit DM Bridge)
│   ├── manifest.json
│   ├── background.js             # Service worker (scanning, DM sending)
│   ├── sidepanel.html/js         # Side panel Activity Hub UI
│   ├── content.js                # App ↔ extension bridge
│   ├── reddit-content.js         # Reddit page content script
│   ├── chat-interceptor.js       # Reddit chat WebSocket interceptor
│   └── offscreen.html/js         # Offscreen document for Reddit scanning
└── research/                     # Research documents
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase project (for database + auth)
- Anthropic API key (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/jacksonspindle/superReddit.git
cd superReddit/app

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys (see Environment Variables below)

# Run database migrations
npx supabase db push

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Chrome Extension

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` directory
4. The SuperReddit DM Bridge icon appears in your toolbar

## Environment Variables

Create a `.env.local` file in the `app/` directory:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic AI (required)
ANTHROPIC_API_KEY=your_anthropic_api_key

# GitHub OAuth (optional — for repo context)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=

# Email alerts via Resend (optional)
RESEND_API_KEY=

# Telegram alerts (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=

# Discord alerts (optional)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
DISCORD_BOT_TOKEN=

# Slack alerts (optional)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=

# Cron jobs (optional)
CRON_SECRET=

# App URL (optional — used in email templates)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Schema

16 migration files define the schema. Key tables:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (auto-created on signup via trigger) |
| `projects` | Marketing campaigns with product info, tone, audience |
| `subreddits` | Tracked subreddits per project |
| `discovered_posts` | Reddit posts fetched and saved |
| `generated_posts` | AI-generated post drafts |
| `chat_messages` | AI chat conversation history |
| `canvas_states` | React Flow canvas snapshots (nodes, edges, viewport) |
| `bookmarks` | Saved/bookmarked posts |
| `github_connections` | GitHub repo connections per project |
| `outreach_configs` | Outreach campaign settings |
| `outreach_keywords` | Search keywords for signal detection |
| `outreach_signals` | Detected high-intent Reddit posts |
| `outreach_replies` | AI-generated reply drafts |
| `monitored_subreddits` | Subreddits being scanned for signals |
| `dm_leads` | DM pipeline leads (Kanban stages) |
| `dm_templates` | Reusable DM message templates |
| `dm_rate_limits` | Per-project DM sending rate limits |
| `alert_channels` | Multi-channel alert configurations |
| `alert_deliveries` | Alert delivery history |

All tables use Row Level Security (RLS) so users can only access their own data.

## Features

### Project Management

Each project represents a marketing campaign for a product. Projects contain:
- Product name, description, URL, and target audience
- Tracked subreddits
- AI tone settings
- Canvas state (React Flow node graph)
- Connected GitHub repos

**Onboarding flow**: 3-step wizard (Product Details → Subreddits → Completion) that creates the project, seeds the canvas with product + subreddit nodes, and redirects to the project dashboard.

### AI Content Generation

13 prompt builders in `src/lib/ai/prompts.ts` power different AI features:

| Prompt | Purpose |
|--------|---------|
| `buildGeneratePrompt` | Generate Reddit posts in 10+ writing styles |
| `buildChatSystemPrompt` | AI chat assistant context |
| `buildSuggestSubredditsPrompt` | AI subreddit recommendations |
| `buildAnalyzeSubredditPrompt` | Analyze subreddit for marketing patterns |
| `buildRewritePrompt` | Rewrite text in a different tone |
| `buildV3ClassificationPrompt` | Score signals on 4 dimensions |
| `buildKeywordGenPrompt` | Generate search keywords for signal detection |
| `buildIntentClassifyPrompt` | Classify post commercial intent |
| `buildReplyDraftPrompt` | Draft authentic reply comments |
| `buildDmDraftPrompt` | Draft personalized DMs |

**Writing styles** include: Struggle & Discovery, The Curious Crowd, Builder's Showcase, PSA Drop, The Showdown, Open Floor, The Playbook, The Contrarian, Experiment Log, and Casual Drop.

### AI Chat Assistant

A streaming chat interface (`/projects/[id]/chat`) that provides contextual help for Reddit marketing. The AI knows your product details, tracked subreddits, and project context. Supports image uploads for visual context. All conversations are persisted to the database for the activity heatmap.

### Reddit Integration

Reddit data is fetched via public `.json` endpoints (no API key required):

- **Fetcher** (`src/lib/reddit/fetcher.ts`): Token-bucket rate limiter (10 req/min) + in-memory cache (10 min TTL)
- **Discovery** (`src/lib/reddit/discover.ts`): Find related subreddits via sidebar links and search
- **Keywords** (`src/lib/reddit/keywords.ts`): Search Reddit by keywords for signal detection
- **Cache** (`src/lib/reddit/cache.ts`): Supabase-backed persistent cache for Reddit responses

### Signal Detection & Outreach

The outreach system scans monitored subreddits for high-intent posts:

1. **Keyword generation** — AI generates search terms based on your product
2. **Signal scanning** — Polls Reddit for matching posts on a schedule
3. **AI scoring** — Each signal is scored on relevance, intent, timing, and conversion potential (V3 classifier)
4. **Compliance checking** — Validates posts against subreddit rules before suggesting engagement
5. **Reply drafting** — AI generates authentic reply comments
6. **Alert delivery** — Notifies you of new high-quality signals

Key libraries in `src/lib/outreach/`:
- `scoring.ts` — Signal quality scoring algorithms
- `compliance.ts` — Subreddit rule compliance checking
- `signal-classifier.ts` — AI-powered signal classification
- `signal-patterns.ts` — Pattern matching for signal detection
- `detector.ts` / `permission-detector.ts` — Post detection utilities
- `dm-templates.ts` — DM template management
- `thread-monitor.ts` — Thread monitoring for follow-up signals

### DM Pipeline

A Kanban-style pipeline for managing Reddit DM outreach:

- **Stages**: New Lead → Researching → Message Drafted → Sent → Replied → Converted
- **Components**: `KanbanColumn`, `KanbanLeadCard`, `ConversationDrawer`, `ConversationTimeline`
- **Features**: Drag-and-drop, bulk send queue, conversation history, DM templates, rate limiting
- **Bridge sync**: Chrome extension syncs sent/reply status back to the pipeline

### Chrome Extension

**SuperReddit DM Bridge** (Manifest V3, v1.6.0) — automates Reddit DM workflows:

| File | Purpose |
|------|---------|
| `background.js` | Service worker: scans Reddit chat, sends DMs, activity logging |
| `sidepanel.html/js` | Activity Hub UI: conversations, stats, activity log, quick compose |
| `content.js` | Bridge between the SuperReddit web app and the extension |
| `reddit-content.js` | Content script injected on Reddit pages |
| `chat-interceptor.js` | Intercepts Reddit chat WebSocket messages (runs in MAIN world) |
| `offscreen.html/js` | Offscreen document for Reddit DOM scanning |

**Side panel features**:
- Reddit login status indicator (green/red dot)
- Stats cards (total chats, sent, replies)
- Searchable conversation list with status badges (Sent/Replied/New)
- Activity log with timestamped events
- Quick compose modal for sending DMs
- Real-time updates via `chrome.storage.onChanged`

### Multi-Channel Alerts

Get notified when new high-quality signals are detected:

- **Email** — Verification flow + digest via Resend
- **Telegram** — Bot integration with start command
- **Discord** — OAuth + webhook channel delivery
- **Slack** — OAuth + channel selection

Each channel has connect/disconnect flows and delivery preference settings. Alert history tracks all deliveries.

### Dashboard & Analytics

The project dashboard (`/projects/[id]`) includes:

- **Stats cards** — Post count, draft count, subreddit count
- **Activity heatmap** — GitHub-style 52-week contribution graph tracking posts, drafts, and chat messages
- **Analytics cards** — Engagement metrics
- **Trending posts** — Top posts from tracked subreddits
- **Plan progress** — Campaign milestone tracking

## API Routes

### AI (`/api/ai/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/ai/chat` | POST | Streaming AI chat with message persistence |
| `/ai/generate` | POST | Generate Reddit posts |
| `/ai/suggest-subreddits` | POST | AI subreddit recommendations |
| `/ai/analyze-subreddit` | POST | Analyze subreddit marketing patterns |
| `/ai/rewrite` | POST | Rewrite text in different tone |
| `/ai/dm-draft` | POST | Generate personalized DM drafts |
| `/ai/outreach-reply` | POST | Generate reply comment drafts |

### Reddit (`/api/reddit/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/reddit` | GET | Fetch subreddit data |
| `/reddit/feed` | GET | Get subreddit post feed |
| `/reddit/search` | GET | Search Reddit posts |
| `/reddit/search-subreddits` | GET | Search for subreddits |
| `/reddit/daily-mix` | GET | Curated daily post mix |
| `/reddit/trending` | GET | Trending posts |
| `/reddit/subreddit-rules` | GET | Fetch subreddit rules |

### Outreach (`/api/outreach/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/outreach/config` | GET/POST | Outreach campaign configuration |
| `/outreach/keywords` | GET/POST | Manage search keywords |
| `/outreach/keywords/generate` | POST | AI keyword generation |
| `/outreach/signals` | GET/POST | Signal management |
| `/outreach/signals/enrich` | POST | Enrich signals with AI scoring |
| `/outreach/signals/scan-status` | GET | Current scan status |
| `/outreach/monitored-subs` | GET/POST | Managed monitored subreddits |
| `/outreach/posts` | GET | Outreach post data |
| `/outreach/replies` | GET/POST | Reply drafts |
| `/outreach/competitors` | GET/POST | Competitor tracking |
| `/outreach/suggest-targeting` | POST | AI targeting suggestions |

### DMs (`/api/outreach/dms/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/outreach/dms` | GET/POST | DM lead management |
| `/outreach/dms/stage` | POST | Update lead pipeline stage |
| `/outreach/dms/sent` | POST | Record sent DMs |
| `/outreach/dms/scan` | POST | Scan for DM opportunities |
| `/outreach/dms/templates` | GET/POST | DM templates |
| `/outreach/dms/rate-limit` | GET | Rate limit status |
| `/outreach/dms/analytics` | GET | DM performance analytics |
| `/outreach/dms/bridge-sync` | POST | Sync from Chrome extension |
| `/outreach/dms/persist-previews` | POST | Save chat previews |

### Alerts (`/api/alerts/`)
| Route | Method | Description |
|-------|--------|-------------|
| `/alerts/email/connect` | POST | Connect email alerts |
| `/alerts/email/verify` | POST | Verify email address |
| `/alerts/email/preferences` | GET/POST | Email preferences |
| `/alerts/telegram/connect` | POST | Connect Telegram bot |
| `/alerts/telegram/webhook` | POST | Telegram webhook handler |
| `/alerts/deliveries` | GET | Alert delivery history |
| `/alerts/disconnect` | POST | Disconnect alert channel |

### Other
| Route | Method | Description |
|-------|--------|-------------|
| `/auth/github` | GET | GitHub OAuth initiation |
| `/auth/github/callback` | GET | GitHub OAuth callback |
| `/context/github/repos` | GET | List connected repos |
| `/context/github/connect` | POST | Connect GitHub repo |
| `/context/github/activity` | GET | Fetch repo activity |
| `/context/outreach` | GET | Outreach context data |
| `/discord/auth-url` | GET | Discord OAuth URL |
| `/discord/callback` | GET | Discord OAuth callback |
| `/slack/auth-url` | GET | Slack OAuth URL |
| `/slack/callback` | GET | Slack OAuth callback |
| `/github/analyze-repo` | POST | AI repo analysis |
| `/github/user-repos` | GET | User's GitHub repos |
| `/projects/bootstrap` | POST | Bootstrap new project |
| `/profile/avatar` | POST | Upload avatar |
| `/cron/poll-signals` | POST | Cron: poll for new signals |
| `/cron/email-digest` | POST | Cron: send email digests |

## Architecture

### State Management

5 Zustand stores manage client-side state:

| Store | Purpose |
|-------|---------|
| `project-store.ts` | Current project data and settings |
| `outreach-store.ts` | Outreach signals, keywords, scan state |
| `bookmark-store.ts` | Bookmarked posts |
| `create-store.ts` | Post creation/editing state |
| `profile-store.ts` | User profile data |

### Authentication

Supabase Auth with cookie-based sessions:
- Server-side client (`src/lib/supabase/server.ts`) for API routes
- Client-side client (`src/lib/supabase/client.ts`) for React components
- Middleware (`src/lib/supabase/middleware.ts`) for session refresh
- GitHub OAuth for repo integration (separate from Supabase auth)

### Reddit Data Pipeline

```
Reddit .json endpoints
        ↓
  Rate Limiter (10 req/min token bucket)
        ↓
  In-Memory Cache (10 min TTL)
        ↓
  Supabase Cache (persistent)
        ↓
  API Routes → Components
```

### Signal Detection Pipeline

```
Monitored Subreddits + Keywords
        ↓
  Reddit Search / Feed Polling
        ↓
  Pre-Filter (fast title screening)
        ↓
  V3 Signal Classifier (4-dimension scoring)
        ↓
  Compliance Check (subreddit rules)
        ↓
  Signal Storage + Alert Delivery
        ↓
  Outreach Pipeline (Kanban)
```

### DM Pipeline Flow

```
Signal/Lead Identified
        ↓
  AI DM Draft Generation
        ↓
  Review & Customize
        ↓
  Chrome Extension Send
        ↓
  Reddit Chat Delivery
        ↓
  Chat Interceptor (reply detection)
        ↓
  Bridge Sync to Platform
        ↓
  Pipeline Stage Update
```

---

Built with Claude Code.
