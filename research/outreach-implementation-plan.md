---
tags:
  - outreach
  - product-strategy
  - ban-safety
  - content-strategy
aliases:
  - Outreach Features
  - Signals Implementation
date: 2026-02-14
category: product-strategy
status: implementation-ready
---

# Outreach Implementation Plan — SuperReddit

> How to implement findings from 55 Subreddit Signals blog posts + competitive research into SuperReddit.
> Research date: 2026-02-14. Companion doc: [[subreddit-signals-blog-extraction]]

---

## Executive Summary

Subreddit Signals teaches 7 scoring systems, 20+ reply frameworks, 4 keyword architectures, and 18 automatable features in their blog content — but only builds basic keyword monitoring into their actual product. We can build the product they describe but never built. Every feature below maps directly to extracted blog knowledge and aligns with the [[SUPERREDDIT-PRODUCT-CONCEPT]].

---

## PART 1: SCORING ENGINE OVERHAUL

### Current State
Our `scoring.ts` uses: `intent(0.5) + freshness(0.3) + engagement(0.2)` with intent_score from a single LLM classification pass. No keyword signals, no disqualifiers, no OP-reply detection.

### Target State
Replace with the **Thread Intent Score (0-10)** from blog extraction:

```
+3: Explicit tool request keywords
+2: Competitor mentioned by name
+2: Budget/pricing/ROI language
+1: Constraints listed (team size, timeline, stack)
+1: Active thread (10+ comments)
+1: OP replies to comments
-2: "Free only" / student signals
-3: Disqualifiers ("just curious," "hypothetical")
```

**Files to modify:**
- `lib/outreach/scoring.ts` — Replace `computeCombinedScore()` with multi-signal scorer
- `lib/outreach/detector.ts` — Feed additional signals (keyword matches, OP reply status) into scorer
- `lib/ai/prompts.ts` — Update intent classification prompt to output structured signals, not just a 0-1 score

**Also add:**
- "3S" badges on SignalCards (Specific / Stakes / Soon checkmarks)
- P0/P1/P2 priority tiers with color coding (red/yellow/gray)
- SLA countdown timers on P0 signals

### Signal Quality Score (SQS) — New Feature
For topic-level analysis (not individual threads):

| Factor | Source |
|--------|--------|
| Velocity | Compare this week's thread count vs last week for same pain area |
| Comment-to-Upvote Ratio | Reddit API data |
| Pain Language Density | NLP keyword count per thread |
| Buyer Mentions | Tool names, budget references, migration language |

**New file:** `lib/outreach/sqs.ts`
**New UI:** "Trending Topics" tab in Signals page that clusters threads by topic and shows SQS score

---

## PART 2: KEYWORD SYSTEM RESTRUCTURE

### Current State
`/api/outreach/keywords/generate` uses a single AI prompt that produces a flat list of 15-20 keywords.

### Target State
Restructure to **3-bucket architecture**:

| Bucket | Count | Purpose |
|--------|-------|---------|
| Problem phrases | 10 | "how do I," "stuck with," "too manual," "anyone else" |
| Solution phrases | 10 | "recommend," "best tool," "what do you use," "alternative to" |
| Competitive phrases | 10 | "[competitor] alternative," "vs [competitor]," "switching from" |

**Plus context filters:**
- Include: question mark, first-person ("I need," "we're looking")
- Exclude: meme, homework, pirated, shitpost

**Files to modify:**
- `lib/ai/prompts.ts` — Rewrite keyword generation prompt for structured 3-bucket output
- `api/outreach/keywords/generate/route.ts` — Return structured buckets, not flat list
- `lib/outreach/detector.ts` — Add include/exclude filter logic before classification
- Setup wizard UI — Show 3 buckets separately, let user edit each

**Also add:**
- 7 alert categories as presets users can enable/disable
- Pain Dictionary auto-builder (scan tracked subreddits, extract recurring phrases via NLP)

---

## PART 3: REPLY BUILDER OVERHAUL

### Current State
Single AI-generated draft with basic compliance check. No structure, no templates, no ban safety.

### Target State
**Template-based reply system** with 5 selectable frameworks:

1. **H.E.L.P.** — Headline, Explain, List, Proof+Permission
2. **DPPI** — Diagnose, Prescribe, Prove, Invite
3. **Demo Bridge** — Mirror, Diagnose, Options, Bridge
4. **Comparison Block** — Tool A vs B vs C with decision rule
5. **Context-Diagnosis-Fix** — Restate, Root cause, Steps, Metric

**Files to create/modify:**
- `components/outreach/ReplyBuilder.tsx` — Add template selector dropdown, show structure scaffold
- `lib/ai/prompts.ts` — Add per-template reply generation prompts
- `lib/outreach/ban-safety.ts` — NEW: Pre-submission validation

### Ban Safety Engine
Validate every draft before showing to user:

| Check | Rule | Action |
|-------|------|--------|
| Link frequency | Max 1 link per comment; 0 in first response | Warning |
| Copy-paste detection | >60% similar to previous reply | Block |
| Comment length | Target 120-220 words | Warning if outside |
| Disclosure present | Auto-append if product mentioned | Auto-fix |
| Subreddit rules | Cross-check against parsed rules | Warning |
| CTA risk level | Flag anything above Level 3 | Warning |
| Account warmth | Warn if <30 non-promo comments in sub | Warning |
| Posting method | Validate native posting via [[create-post-flow]] | Warning |

**New file:** `lib/outreach/ban-safety.ts`

### Reply Cadence System
Support the 3-Touch follow-up (Touch 2 leverages the DM workflow from [[dm-feature-research]]):
- Touch 1 (0-2 hours): Solution + qualifying question
- Touch 2 (24 hours): Permission-based DM template
- Touch 3 (72 hours): Binary close

Track touch count per signal in `outreach_replies` table.

---

## PART 4: SUBREDDIT DISCOVERY V2

### Current State
`extractSearchTerms()` → Reddit `/subreddits/search` → Claude picks best → verify existence. Single-pass, name/description/subscribers only.

### Target State
Multi-signal discovery engine using **Three-Part Fit Model**:

1. **Intent Fit** — Scan recent posts for solution-seeking language
2. **Tone Fit** — Parse rules + analyze top post tone for commercial tolerance
3. **Context Fit** — Check if product-category content appears naturally

### Enhanced Scoring Per Subreddit

| Signal | Weight | Source |
|--------|--------|--------|
| Semantic Fit (intent + context fit) | 25% | Post content sampling + AI |
| Audience Overlap | 25% | Cross-posting analysis |
| Engagement Quality (posts/day, comments/post) | 20% | Reddit API |
| Commercial Tolerance (tone fit + compliance) | 15% | Rule parsing + post history |
| Growth Trajectory | 10% | Subscriber delta |
| Content Freshness | 5% | Recent post dates |

### Portfolio Management Rules (from blogs)
- Start with 10 subs, not 100
- 70% problem-focused + 30% buyer-comparison mix
- Prune subs with <5 qualified threads/week
- Add 3 test subs weekly
- Track which 2-3 drive 80% of results

### Size Bucketing Update
- Current: 1K minimum (too low)
- New: Niche (5K-50K), Sweet spot (50K-500K, prioritize), Large (500K+, cap at 6)

**Files to create/modify:**
- `lib/reddit/discovery.ts` — NEW: Multi-signal analysis engine
- `api/ai/discover-subreddits-v2/route.ts` — NEW: Enhanced discovery endpoint
- `lib/ai/prompts.ts` — Enhanced suggestion prompt with post content, engagement data, compliance
- `components/onboarding/steps/SubredditsStep.tsx` — Richer discovery UI

### Subreddit Health Dashboard (New Page)
Show per-subreddit:
- Qualified threads/week
- Average intent score of signals from this sub
- Commercial tolerance score (6 dimensions)
- Growth rate
- "Performance rank" vs other tracked subs
- Auto-flag underperformers, suggest replacements

---

## PART 5: LEAD PIPELINE (TRACKER PAGE UPGRADE)

### Current State
Basic list of replies with status (draft/copied/posted/tracking).

### Target State
**6-Stage Reddit Lead Pipeline:**

1. Signal Captured → 2. First Touch → 3. Context Qualified → 4. Off-Reddit Handshake → 5. Call/Trial → 6. Closed Won/Lost

### SLA System
- P0 (score 8-10): <2 hour timer, red badge
- P1 (score 5-7): Same day, yellow badge
- P2 (score <5): 48 hours, gray badge
- Visual countdown timer on each card

### Required Fields Per Lead
Thread URL, subreddit, problem statement, intent score, comment link, permission status, next action, follow-up due date, pipeline stage, outcome, loss reason

### DB Changes
Add columns to `outreach_replies`:
- `pipeline_stage` (signal_captured | first_touch | qualified | off_reddit | trial | closed_won | closed_lost)
- `follow_up_due` (timestamptz)
- `loss_reason` (text, nullable)
- `next_action` (text, nullable)

**UI:** Kanban-style pipeline view with drag-and-drop stage management. Alternative: Keep grid but add stage filter tabs.

---

## PART 6: TRACKING & ATTRIBUTION

### UTM Auto-Generation
When user copies a reply that includes a link, auto-append:
```
?utm_source=reddit&utm_medium=comment&utm_campaign=r_{subreddit_name}
```

### Weekly Analytics Dashboard (New Page)
| Metric | How to Track |
|--------|-------------|
| Qualified threads reviewed | Count signals viewed per week |
| Comments posted (copied) | Count replies with status 'copied' or 'posted' |
| Reply-to-positive rate | Track if OP responds (op_replied field) |
| Pipeline conversion | Stage progression rates |
| Top performing subreddits | Aggregate by sub |
| Time-to-first-reply | Signal fetched_at vs reply created_at |

### Voice-of-Customer Capture
Auto-extract from signal threads:
1. Exact pain quote
2. Pain point category
3. Desired outcome
4. Current workaround
5. Tools mentioned

Store as structured data for keyword refinement and product positioning.

---

## PART 7: SUBREDDIT COMPLIANCE V2

### Current State
`compliance.ts` parses rules for promo restrictions, computes a 0-1 safety score. Used only in outreach, not in subreddit discovery.

### Target State
**6-Dimension Compliance Scoring** (integrate into both discovery and outreach):

| Dimension | What to Check | Score |
|-----------|---------------|-------|
| Rules scan | Self-promo, link policies, flair | 1-10 |
| Culture scan | Top posts tone analysis | 1-10 |
| Promotion tolerance | Removed self-promo posts | 1-10 |
| Account trust reqs | Min age, min karma rules | 1-10 |
| Link risk | No-link policies | 1-10 |
| Frequency caps | Posting limits, cooldowns | 1-10 |

Total /60, normalize to 0-1 for compatibility.

**Files to modify:**
- `lib/outreach/compliance.ts` — Add 6-dimension scoring
- Use in subreddit discovery (filter out strict subs during suggestion)
- Show detailed breakdown in UI (not just green/yellow/red)

---

## PART 8: CONTENT TEMPLATES (AI WRITER INTEGRATION)

### Add Proven Post Formats to AI Writer / Splicer

These templates are derived from the 12 post archetypes catalogued in [[reddit-post-styles]]:

1. **Playbook** — "How I fixed ___ in 7 days (with screenshots + numbers)"
2. **Checklist** — "My 12-point audit for ___ (copy/paste)"
3. **Lessons Learned** — "I wasted $2,000 on ___ so you don't have to"
4. **Comparison** — "I tested 5 tools for ___: here's what surprised me"
5. **Proof Post** — Context → Problem → Data → Method → Tradeoffs → Disclosure
6. **AMA Prep** — Topic + metrics + scope + disclosure template

These formats consistently get engagement in r/SaaS, r/startups, r/Entrepreneur.

---

## PART 9: REDDIT SEO FEATURES (UNIQUE DIFFERENTIATOR)

No competitor does this. Reddit appears in 97.5% of product review Google searches (see [[reddit-market]] for the full Google visibility data).

### SERP Opportunity Detection
- For each signal thread, check if it ranks on Google for relevant keywords
- Flag "Google-ranking threads" with a special indicator
- Prioritize these — your comment gets Google traffic indefinitely

### Under-Answered Thread Detection
- High views + <8 comments = high-value opportunity
- Flag these in the signals feed

### Evergreen Thread Monitoring
- Track threads that continue getting traffic months later
- Suggest refreshing/editing old comments

**Implementation:** Add a "Google Ranking" badge on SignalCards. New API route that checks `site:reddit.com` ranking for target keywords.

---

## PART 10: COMMUNITY GRAPH (FUTURE PHASE)

### Splinter Detection
Track user overlap between subreddits over time:
- "Overlap drops while activity rises" = community splitting
- Splinter subs have sharper pain points, clearer norms, higher conversion potential
- Bridge subs = good for learning norms before engaging splinters

### Relationship Types
| Signal | Best For |
|--------|----------|
| User migration/overlap | Splinter detection |
| Shared domains | Product/category research |
| Cross-posting frequency | Content propagation |
| Semantic similarity | Sparse user overlap |

### Implementation
Start collecting data now (track unique commenters per sub). Build visualization later.

**New table:** `subreddit_relationships` (sub_a, sub_b, overlap_score, relationship_type, measured_at)

---

## PRIORITY MATRIX

| Priority | Feature | Impact | Effort | Source Blogs |
|----------|---------|--------|--------|-------------|
| **P0** | Enhanced intent scoring (0-10) | High | Medium | Posts 4, 8, 13, 17, 22, 28 |
| **P0** | 3-bucket keyword architecture | High | Low | Posts 4, 15, 18, 21, 28 |
| **P0** | Reply template library (5 frameworks) | High | Medium | Posts 7, 12, 13, 16, 22 |
| **P1** | Ban safety engine | High | Medium | Posts 1, 7, 18, 24, 33 |
| **P1** | 6-dimension compliance scoring | Medium | Medium | Posts 10, 25, 33 |
| **P1** | Lead pipeline stages (6-stage RLP) | High | Medium | Posts 8, 11 |
| **P1** | 3S qualification badges | Medium | Low | Post 22 |
| **P1** | SLA timers on signals | Medium | Low | Posts 4, 8, 21, 28 |
| **P2** | UTM auto-generation | Medium | Low | Posts 16, 17, 18 |
| **P2** | Weekly analytics dashboard | Medium | Medium | Posts 13, 17, 28 |
| **P2** | Subreddit health dashboard | Medium | Medium | Posts 25, 26, 28 |
| **P2** | Voice-of-Customer capture | Medium | Medium | Post 9 |
| **P2** | Content format templates (AI Writer) | Medium | Low | Posts 7, 24, 25 |
| **P3** | Reddit SEO / SERP detection | High | High | Post 23 |
| **P3** | Pain Dictionary auto-extraction | Medium | High | Posts 9, 32, 33 |
| **P3** | Community graph / splinter detection | Medium | High | Post 35 |
| **P3** | Signal Quality Score (SQS) topics | Medium | Medium | Post 36 |
| **P3** | Post timing optimizer | Low | Medium | Multiple |

---

## KEY COMPETITIVE INSIGHT

Subreddit Signals publishes all of this knowledge as SEO content marketing (fully extracted in [[subreddit-signals-blog-extraction]]). Their actual product only does basic keyword monitoring at $20-50/mo. Every feature in this plan is something they describe in blogs but never built. We build the product they market.
