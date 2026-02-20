---
tags:
  - competitor/subreddit-signals
  - outreach
  - ban-safety
  - content-strategy
aliases:
  - Subreddit Signals Intel
  - 55-Post Extraction
date: 2026-02-14
category: competitor-analysis
status: reference
---

# Subreddit Signals Blog Extraction — 55 Posts Fully Ingested

> Research conducted 2026-02-14. All 55 blog posts from subredditsignals.com read and extracted by a 4-agent research team. See [[outreach-implementation-plan]] for the companion doc that turns these findings into actionable steps.

---

## Table of Contents

1. [Scoring Systems](#1-scoring-systems)
2. [Keyword Architecture](#2-keyword-architecture)
3. [Reply Templates & Frameworks](#3-reply-templates--frameworks)
4. [Subreddit Evaluation Criteria](#4-subreddit-evaluation-criteria)
5. [Ban Avoidance Rules](#5-ban-avoidance-rules)
6. [Lead Pipeline & CRM](#6-lead-pipeline--crm)
7. [Reddit Ads Framework](#7-reddit-ads-framework)
8. [Reddit SEO](#8-reddit-seo)
9. [Content & Post Formats](#9-content--post-formats)
10. [Tracking & Attribution](#10-tracking--attribution)
11. [Platform Stats & Benchmarks](#11-platform-stats--benchmarks)
12. [Community Graph & Splinter Detection](#12-community-graph--splinter-detection)
13. [AI Content Guardrails](#13-ai-content-guardrails)
14. [Execution Timelines](#14-execution-timelines)

---

## 1. Scoring Systems

### A. Thread/Lead Intent Score (0-10 Scale)

| Signal | Points | Detection Method |
|--------|--------|-----------------|
| Explicit tool request ("looking for," "recommend," "best tool") | +3 | Keyword match |
| Competitor mentioned by name | +2 | Competitor list match |
| Budget/pricing/ROI language | +2 | Keyword match |
| Constraints listed (team size, timeline, stack) | +1 | NLP pattern match |
| Active thread (10+ comments, rapid replies) | +1 | Reddit API data |
| OP replies to comments (urgency signal) | +1 | Reddit API data |
| "Free only" (if paid product) | -2 | Keyword match |
| Student/homework signals | -2 | Keyword match |
| Disqualifier ("just curious," "hypothetical") | -3 | Keyword match |

**Action thresholds:**
- 8-10 = Reply within 30-60 min (P0)
- 5-7 = Reply same day (P1)
- 0-4 = Monitor only / ignore (P2)

### B. Lead Score (0-100 Scale)

| Signal | Points |
|--------|--------|
| Active problem with constraints (budget, timeline, tools) | +25 |
| Request for recommendation or advice | +20 |
| Tried alternatives and failed (switch intent) | +15 |
| Response to your comment within 2 hours | +15 |
| Original poster status | +10 |
| Account history matches ICP | +10 |
| Compliance/security/procurement mention | +5 |
| Subreddit rules prohibit commercial replies/DMs | -20 |
| "Cheap/free only" incompatible with offering | -10 |

**Action thresholds:**
- 70-100: Respond within 30 min
- 40-69: Respond within 24 hours
- <40: Monitor only

### C. Intent Scoring Rubric (0-3 Scale)

- 3 = Active buying ("Looking for a tool that...")
- 2 = Switching friction ("We're leaving X because...")
- 1 = Problem awareness ("How do you handle...?")
- 0 = Opinion/entertainment (non-actionable)

### D. Thread-Level Scoring (1-5 Points)

- +2: Direct request ("Any tool for X?")
- +2: Pain + urgency ("need to fix this week")
- +1: Budget/constraints mentioned
- +1: Competitor mention
- +1: Implementation details present
- **Threshold**: 3+ = pursue immediately

### E. RT Score (Relevance x Tolerance)

Score each subreddit 1-5 on:
- **Relevance**: ICP problem match
- **Tolerance**: Tool/link friendliness
- Multiply scores; priority subreddits score 15+
- Sub-10-minute tolerance audit: check rules, scan top posts for tools/brands, verify mod enforcement

### F. Subreddit Scoring Model (1-5 Scale, Total /25)

Five dimensions: Problem Intensity, Solution Seeking, Moderator Strictness, Content Fit, Audience Match

### G. Signal Quality Score (SQS) — 4-Factor Model

| Factor | What It Measures |
|--------|-----------------|
| Velocity | Week-over-week post/comment growth in same pain area |
| Comment-to-Upvote Ratio | High comments = unresolved problems (stronger demand signal) |
| Pain Language Density | Count specific phrases ("subscription creep," "simplest way," "tooling is overkill") |
| Buyer Mentions | Named tools, budget references ("$50/month"), migration language, "alternatives" queries |

### H. Thread Quality Scoring for SEO

| Signal | Weight | Threshold |
|--------|--------|-----------|
| Intent match (title clarity) | 25% | >7/10 |
| Comment depth (average length) | 25% | >3 substantive comments |
| Comment diversity (unique posters) | 20% | >3 different voices |
| OP credibility (constraints shared) | 15% | Specific details mentioned |
| Age/freshness | 15% | <7 days old |

Action threshold: Score >70 = worth commenting on

### I. Demand Risk Score (-2 to +2)

- +2 = Strong purchase intent
- +1 = Cautious/conditional buy
- 0 = Neutral sentiment
- -1 = Price objection without switching threat
- -2 = Explicit switching intent
- **Thresholds**: Switching intent >20% -> add value bundling; Trust objections dominate -> emphasize transparency

### J. "3S" Quick Qualification Filter (15 seconds)

- **Specific**: Names tools, workflows, constraints
- **Stakes**: Problem affects revenue, churn, compliance, or time-to-market
- **Soon**: Decision timeline is "this week," "this month," or "before launch"

### K. 5-Point Qualification Criteria

1. Role fit: founder, growth, marketing, ops, or product
2. Problem clarity: describes current pain (not exploratory)
3. Urgency signals: tool switching, launch deadlines, budget cycles
4. Budget authority: decision-maker or direct access
5. Context depth: mentions stack, constraints, prior attempts

### L. Mod-Safe Compliance Scoring (6 Dimensions, 1-10 each)

1. Rules scan: subreddit rules + pinned posts + posting flairs
2. Culture scan: analyze top posts for tone
3. Promotion tolerance: search for removals of self-promo
4. Account trust check: profile history, non-promotional activity
5. Link risk assessment: determine if no-link strategy required
6. Frequency cap: avoid repetitive posting across subreddits

Moderator Rules Traffic Light:
- Green (allowed with value) / Yellow (weekly thread only) / Red (ban risk)

---

## 2. Keyword Architecture

### The 30-Keyword Bank (3 Buckets)

| Bucket | Count | Examples |
|--------|-------|---------|
| **Problem phrases** | 10 | "how do I," "anyone else," "is it normal," "workflow for," "template for," "tracking," "automation for," "stuck with," "too manual" |
| **Solution phrases** | 10 | "recommend," "best tool," "best software," "what do you use," "stack," "setup," "template," "download," "platform for" |
| **Competitive phrases** | 10 | "alternative to [X]," "vs [X]," "moving from [X]," "replace [X]," "pricing [X]," "too expensive," "limitations of [X]" |

### 7 Alert Setup Categories

1. **"Looking For / Recommend"** (Highest Intent): "looking for," "any recommendations," "recommend" AND ("tool" OR "software"), "best" AND ("tool" OR "software"), "anyone use," "what do you use for," "suggest"
2. **Competitor + Alternative**: "alternative to [X]," "[X]" AND ("pricing" OR "expensive"), "switching from [X]," "[X]" AND ("hate" OR "issue" OR "bug"), "vs"
3. **Pricing + Budget**: "pricing," "cost," "budget," "worth it," "ROI," "quote," "per seat," "annual" OR "monthly," "renewal"
4. **Problem-First Pain**: "how do I" + ("automate" OR "track" OR "monitor"), "we're stuck," "manual AND spreadsheet," "too many" AND ("tools" OR "tabs"), "missed" AND ("follow up" OR "SLA"), "no visibility"
5. **Comparison + Shortlist**: "vs," "compare," "which is better," "pros and cons," "shortlist," "deciding between," "top 3"
6. **Implementation + Integration**: "integrate," "API," "webhook," "SSO," "SCIM," "SOC2," "migration," "setup AND stuck"
7. **Negative Sentiment (Churn Rescue)**: "doesn't work," "broken," "bug," "support AND no response," "downtime," "refund," "cancel," "data loss"

### Starter Pack (25 Keywords)

looking for, recommend, best tool, anyone use, alternative to, switching from, pricing, cost, budget, worth it, ROI, demo, trial, compare, vs, pros and cons, shortlist, integrate, API, webhook, migration, setup, stuck, support not responding, refund

### Context Filters

- **Include**: recommend, alternative, switching, pricing, budget, trial, demo, integrate
- **Exclude**: meme, shitpost, homework, pirated, crack, free download
- **Require**: question mark OR first-person language ("I need," "we're looking")

### High-Intent Signal Phrases

"Alternative to...", "is X worth it", "how do I integrate...", "pricing for...", "fed up with", "switching from", "X broke", "support is terrible", "looking for a tool that...", "any recommendations for..."

### 7 Signal Types to Monitor

1. Tool-Switch Language ("alternative to X," "leaving X," "migrating from X")
2. Budget + Constraints ("under $200/mo," "must work with HubSpot," "SOC 2 required")
3. Repeated Pain Posts (same complaint across 5+ threads in 30 days = demand signal)
4. High-Signal Comments (top comments with competitive intel, workarounds, outcomes)
5. Moderator Rules (Green/Yellow/Red scoring)
6. Community Intelligence Trends (rising themes)
7. Asset-Convertible Threads ("X vs Y" pages, "Best tools for [persona]" posts)

### ICP Pain Dictionary

Define 20-50 phrases users actually use in problem discussions. Focus on pain-first keywords (not product categories): "onboarding drop-off," "churn," "cold email deliverability" — NOT "email marketing tool."

---

## 3. Reply Templates & Frameworks

### A. H.E.L.P. Structure

- **H** = Headline (mirror problem in one sentence)
- **E** = Explain (root cause, non-judgmental)
- **L** = List (3-7 actionable steps)
- **P** = Proof + Permission (result, source, optional soft mention)

### B. DPPI Framework

- **D**iagnose: Restate their situation
- **P**rescribe: 2-4 concrete steps
- **P**rove: Add credibility marker
- **I**nvite: Offer helpful next step

### C. Demo Bridge Template (4-Part)

1. Mirror: Restate their situation in 1 sentence
2. Diagnose: Name root problem + causation
3. Options: 2-3 paths including non-product solution
4. Bridge: Low-friction next step ("Want me to DM you a 5-min demo video?")

### D. Context-Diagnosis-Fix-Proof

1. Restate situation (1 sentence)
2. Name likely root cause (1-2 options)
3. Provide 10-30 minute actionable steps
4. Add metric/result/example

### E. Comment Formula (5-Part)

1. Context (1 sentence): "I ran into this when..."
2. Diagnosis (1-2 sentences): "Usually it's caused by..."
3. Steps: 3-5 numbered actions
4. Tools: 1-3 options (include competitors)
5. Disclosure: "If it helps, I built/use X -- happy to share details"

### F. 80/20 Comment Structure

- Direct answer in 1-2 lines
- Checklist/steps (3-7 bullets)
- One concrete example
- Optional: mention tool as "one option"

### G. Comparison Block Template

- Tool A: Best for [use case], [2 pros], [2 cons]
- Tool B: Best for [use case], [2 pros], [2 cons]
- Tool C (yours): Best for [use case], [2 pros], [2 cons]
- Decision rule: "If you prioritize X, choose A. If Y matters most, go with B."

### H. Method-First Positioning

[Method statement] -> [Manual option] -> [Tool option with disclosure]

### I. 3-Touch Cadence

- Touch 1 (0-2 hours): 3-6 sentence solution + one qualifying question
- Touch 2 (24 hours): Permission-based DM template
- Touch 3 (72 hours): Binary choice. Stop after no response.

The DM permission and cadence rules here align closely with the findings in [[dm-feature-research]].

### J. Non-Salesy Product Mention Templates

1. "If you want example: [solution]. (Also built tool -- happy to share if relevant.)"
2. "Two options: (1) manual [X] (2) automated [Y]. Biased on #2."
3. "Comparing tools? 3 criteria: [X,Y,Z]. Can share our differences."
4. "I wrote checklist. Want me to paste?"
5. "Disclosure: founder. Constraints? I'll tailor steps."

### K. Soft CTA Phrases

- "If you want, I can share the checklist I use"
- "Happy to explain how I'd approach it with your numbers"
- AVOID: "DM me for pricing," "Sign up here," "Limited spots"

### L. Disclosure Statement Templates

- "Full disclosure: I'm founder of X. Here's unbiased approach..."
- "I work on tool in this space -- happy to share learnings regardless of adoption"
- "Not selling -- offer link if wanted; otherwise here are manual steps"

### M. Compliant DM Script

"Hey -- saw your comment about [problem]. I put together a quick [resource] that covers [specific]. Want me to share it here, or would a link be easier? (No worries if not.)"

### N. VALUE-FIRST COMMENT LADDER (5-step permission escalation)

1. Diagnose: Restate problem + ask 1 clarifying question
2. Mini-solution: Provide framework/checklist/decision tree (no links)
3. Provide options: 2-4 approaches including non-paid alternatives
4. Soft mention: "If relevant, I can share a template I use"
5. DM-only consent: "Want me to DM the checklist?" (never cold-DM)

---

## 4. Subreddit Evaluation Criteria

### Three-Part Fit Model

1. **Intent Fit**: Do people actively seek solutions here?
2. **Tone Fit**: Does the culture accept product mentions?
3. **Context Fit**: Does your message blend with rewarded content types?

### Size Sweet Spots

- **Best**: 50K-500K members (consistent across all posts)
- Niche (5K-50K): High intent density, lower volume
- Large (500K+): High volume but diluted intent

### 3-Layer Subreddit Filter

1. Problem fit: Does community discuss your pain point?
2. Permission fit: Are links/promos allowed per rules?
3. Proof fit: Do top comments include tactics, screenshots, templates, real numbers?

### 3-Bucket Framework

- Bucket A (Validation): Founder/strategy communities
- Bucket B (Conversion): Practitioner communities (devs, PMs, marketers)
- Bucket C (Volume): Promo-allowed communities (supplement only)

### 3-Layer Alert Architecture

- Layer 1: Core subreddits (10-30 where ICP seeks tools)
- Layer 2: Adjacent subreddits (20-50 where problems surface)
- Layer 3: Exclusion rule (meme/low-signal communities)

### Portfolio Management Rules

- Start with 10 subreddits, not 100
- Mix: 70% problem-focused + 30% buyer-comparison communities
- **Pruning rule**: Remove subs generating <5 qualified threads/week
- **Testing rule**: Add 3 new test subs weekly
- Key finding: 2-3 subreddits drive 80% of traction

### Subreddit Tone Matching

- r/SaaS: Data-driven, founder-to-founder (numbers, lessons, experiments)
- r/Marketing: Tactical, professional (frameworks, receipts, process)
- r/Startups: Honest, uncertain (decisions, tradeoffs, postmortems)
- r/Digital_Marketing: Educational, methodical (channel results, edge cases)

### Evaluation Dimensions

| Criterion | Measure |
|-----------|---------|
| Posting Patterns | Top 30-day posts; style/length/framing |
| Engagement Style | Comment depth (thoughtful vs quick) |
| Commercial Tolerance | Product mention enforcement spectrum |
| Search Presence | Google ranking potential |
| Buyer Intent Density | Recurring "recommend," "alternative," "how-to" posts |
| Response Velocity | Comments within 2-6 hours (fast = capture intent) |

### Thread Disqualification Rules

- Student/homework signals
- "Free/open source only" (if paid product)
- Obvious spam or bot posts
- Cross-posted 5+ times
- Threads older than 72 hours with no new replies
- Your product genuinely doesn't fit
- Thread dominated by 5+ established answers

---

## 5. Ban Avoidance Rules

The rules below form the safety foundation for our [[create-post-flow]] — every guideline here is something SuperReddit should enforce or surface in the UI.

### Universal Rules (Confirmed Across 40+ Posts)

- **90/10 Rule**: 90% value, 10% promotion (only when asked or relevant)
- **3:1 Ratio**: 3 helpful comments per 1 promotional post
- **15-25 comments before first product mention**
- **Comment daily 14 days before first post** (20-30 helpful comments)
- Read rules + pinned posts before every interaction
- Disclose affiliations plainly
- No links unless explicitly allowed; avoid shortened URLs (autofiltered)
- Never lead with a link
- No corporate language ("We're thrilled to announce...")
- No copy-paste same comment across threads (spam signal)
- No "DM sent" -- always offer value inline first, ask permission
- Never automate first touch -- keep initial interaction manual
- Reply to every serious comment within 24 hours
- One account per community

### Minimum Credibility Targets

- Account age: 30+ days
- Combined karma: 200-500
- Community footprint: 10-20 non-promotional comments in target subs
- Warm-up: 30-50 genuine comments before any self-promotion

### 10 Common Mistakes

1. New account + zero history = immediate red flag
2. Ignore subreddit rules/flair = removal
3. Copy/paste same comment = spam signal
4. Astroturfing (fake customer claims) = unethical
5. Argue with mods = relationship poison
6. Link drop without value summary = deletion
7. Suspicious URL shorteners = auto-filter
8. Launch posts where unwelcome = ban risk
9. Founder disclosure omission = trust loss
10. Downvote defensiveness = community friction

### CTA Risk Ladder

| Level | Tactic | Risk |
|-------|--------|------|
| 1 | Zero-link post; pure help | Lowest |
| 2 | Comment replies (10-20/week); no product mention | Low |
| 3 | Soft mention, no link | Medium |
| 4 | Opt-in DM offers | Medium-High |
| 5 | Link only when requested | High |
| 6 | Hard CTA + link (promo-allowed subs only) | Highest |

### 90/10 Trust-Building Protocol

| Week | Action | Link Policy |
|------|--------|-------------|
| 1 | Lurk, save 30 threads, comment on 10 | Zero links |
| 2 | Share 1 mini-guide (300-600 words) | No links |
| 3 | Add 3 resource comments | Link only when requested |
| 4 | Post 1 case study with metrics | Disclose affiliation |

### Contingency Protocols

- If post removed: don't repost; message mods asking what rule was violated
- If "self-promo" pushback: pause posting 7-14 days, shift to comment-only
- If DMs blocked: keep all conversation in-thread

### Comment Length Sweet Spot

120-220 words (utility vs. readability balance)

### Anti-Spam Detection Avoidance

- Vary opening phrases across comments
- Vary formatting (don't repeat bullet structures identically)
- Space out posts
- Limit link frequency (max 1 per 5 comments)
- Mix promotional and non-promotional (80/20 minimum)

---

## 6. Lead Pipeline & CRM

### Reddit Lead Pipeline (RLP) — 6 Stages

1. **Signal Captured** — Post URL, subreddit, user's problem phrasing
2. **First Touch** — Public comment or DM response
3. **Context Qualified** — Confirm severity, workaround, timeline
4. **Off-Reddit Handshake** — Transition to email/call
5. **Call/Trial** — Standard sales pipeline with Reddit context
6. **Closed-Won/Lost** — Log reason: pricing, timing, feature, trust

### 3-SLA Follow-Up System

- SLA #1 (same-day): Capture + set next step within 4 hours
- SLA #2 (48-hour): Propose 2 concrete options if replied
- SLA #3 (7-day): "Want me to stop nudging?" then mark as nurture

### Response Time SLA Tiers

- Tier 1 (score 70-100): 30-60 minutes
- Tier 2 (score 40-69): 4-24 hours
- Tier 3 (score <40): Monitor only / 24 hours with mini-guide

### Lead Qualification — Confirm 3 Before Advancing

1. Problem severity (scale or description)
2. Current workaround (what they're using now)
3. Timeline (when they need to solve)

### Minimum Required Data Fields Per Lead

Lead ID, Reddit username, Subreddit, Thread URL, Comment/reply URL, Lead source, Problem statement, Help angle offered, Permission status (No/Asked/Granted), Next action, Follow-up due date, Pipeline stage, Lead score

### Spreadsheet vs CRM Decision

- Stay spreadsheet: <10 leads/week, 1 person, <7 day cycle, no automation needed
- Migrate to CRM: Miss follow-ups >1x/week, 2+ people, need stage tracking, multiple sources

### DM Policy (strict permission-based)

These rules echo and reinforce the DM cadence research in [[dm-feature-research]]:

1. Only DM after explicit consent in-thread
2. Single-purpose DM (send requested resource only)
3. No pitch in first DM; ask if they want options
4. Log all DMs: date, subreddit, post URL, content sent

### Voice-of-Customer (VoC) Capture — 5-Column System

1. Exact quote (preserve original language)
2. Pain point identified
3. Desired outcome
4. Current workaround
5. Tool mentioned

### Competitor Monitoring Categories

Feature gaps, Pricing friction, Onboarding complaints, Support issues, Unexpected positive mentions.
Frequency: Weekly, 20-50 mentions per cycle.

---

## 7. Reddit Ads Framework

### Campaign Structure

- 1 campaign per funnel stage (Prospecting vs Retargeting)
- 2-4 ad groups maximum at launch
- Single targeting method per ad group
- 3-5 creatives per ad group

### Bidding Strategy Progression

| Phase | Duration | Strategy | Trigger |
|-------|----------|----------|---------|
| Learning | Days 1-14 | Lowest Cost | 30+ conversions recorded |
| Control | Days 15-45 | Cost Cap | Stable CPA baseline |
| Scale | Day 46+ | Cost Cap (expand) or Manual | 20-30% budget increases every 48-72 hours |

### Budget Minimums

- $50-150/day per campaign for reliable signal
- Conversion requirement: ~30 conversions for directional truth
- If expected CPA = $40: required spend = ~$1,200

### Targeting Hierarchy

- Tier 1 (Highest Intent): Subreddit targeting, 10-30 communities max
- Tier 2 (Problem-Aware): Keyword targeting, 20-60 terms
- Tier 3 (Discovery): Interest targeting (separate ad group)

### CPA Target Formula

```
Step 1: Gross Profit = (Monthly Price x Retention Months x Gross Margin %)
Step 2: CAC Budget = Gross Profit x Payback Tolerance Ratio
Step 3: Target CPA = CAC Budget / Close Rate
Example: $99/mo x 8 months x 80% margin = $634 gross profit
6-month payback = $317 CAC ceiling
20% close rate = $63 trial CPA target
```

### Creative Formula

- Problem -> specific outcome -> proof (with numbers)
- Headlines formatted as post titles (not slogans)
- Single clear CTA
- One credibility marker
- Zero hype words
- Objection pre-emption in first 2 lines

### Landing Page Structure (Reddit-Specific)

1. Above fold: One-sentence value prop + primary CTA
2. Qualification block: "Who this is for / not for"
3. Proof block: 3 bullets with quantified results
4. FAQ block: Pricing, setup time, integrations
5. Secondary CTA for skeptics

### 30/60/90-Day Ad Optimization

- Days 1-7: Pause bottom 20% creatives by CTR + sentiment; add 10-20 keywords from comment analysis
- Days 8-30: Transition Lowest Cost -> Cost Cap; A/B test landing page; expand adjacent subreddits
- Days 31-90: Scale 20-30% every 48-72h on winners; introduce Max Campaigns; build retargeting

### Ad Format Performance Ranking

1. AMA Ads (highest intent) - RSVP prompts, automated reminders
2. Sponsored posts
3. Conversation ads
4. Video formats

---

## 8. Reddit SEO

Reddit threads now appear in **97.5% of product review Google searches**. Reddit content is cited in **40.11% of AI-generated responses**.

### Thread Lifecycle for Commenting

| Phase | Timeline | Action | Goal |
|-------|----------|--------|------|
| 1 | 0-24 hours | Comment with hook answers | Build momentum |
| 2 | 2-7 days | Add long-form comparisons | Become Google-worthy |
| 3 | 2-8 weeks | Refresh with edits | Long-tail ranking |
| 4 | 2-12+ months | Monitor evergreen pull | Sustain traffic |

### 9 Thread Discovery Plays

1. Google Radar: `site:reddit.com "keyword" + (best|alternative|vs|worth|pricing)`
2. SERP Subreddit Watchlist: 10-30 communities with repeated ranking threads
3. Evergreen Question Format Monitoring
4. Comparison Cluster Catching
5. Safe Automation (monitoring/triage only)
6. Pain Keyword Following
7. OP Context Priority (threads with constraints rank better)
8. Under-Answered Thread ID (high views + only 3-8 comments)
9. Reverse-Engineer Ranking Patterns

### Comment Structure for SEO

- One-line credibility context
- Direct answer (3-5 bullets)
- Trade-offs section
- Step-by-step or checklist (5-9 steps)
- Optional soft product mention (10% max)
- Word target: 150-300 words

### Weekly 60-Minute Reddit SEO System

- Monday (15 min): Pull 30-50 fresh threads, filter to 10
- Wednesday (30 min): Write 2 "ranking-grade" comments (150-300 words each)
- Friday (15 min): Google search commented thread titles, log rankings

### GEO (Generative Engine Optimization)

- Schema markup for FAQs, reviews, product info
- Clear, concise, fact-rich answers
- Optimize for featured snippets
- Key takeaways at top of pages

---

## 9. Content & Post Formats

The post types and formatting guidance below overlap with and extend [[reddit-post-styles]] — cross-reference for tone and structure details.

### 5 Anti-Marketer Post Types

1. **[Playbook]** "How I fixed ___ in 7 days (with screenshots + numbers)"
2. **[Checklist]** "My 12-point audit for ___ (copy/paste)"
3. **[Lessons]** "I wasted $2,000 on ___ so you don't have to"
4. **[Comparison]** "I tested 5 tools for ___: here's what surprised me"
5. **[Request]** "Can you critique my onboarding? Here's what I'm seeing"

### 4 High-Intent Thread Types

- "What tool do you use for ___?" (solution shopping)
- "Alternative to ___?" (switching intent)
- "How do I ___?" (workflow pain + urgency)
- "Is ___ worth it?" (evaluation phase)

### Proof Post Structure

1. Context (1 sentence): credibility claim, no hype
2. Problem statement: constraints included
3. Data: 3-7 concrete metrics
4. Method: replicable steps independent of product
5. Tradeoffs: what failed; alternatives
6. Disclosure line: "Founder of X. No links unless asked"

### AMA Framework

1. Topic: hard-won result (not company story)
2. Proof: metrics, timeline, action breakdown
3. Scope: what you will/won't answer
4. Disclosure: credentials and why qualified
5. Follow-up: recap post with learnings

### AMA Topic Formulas

- "Migrated from [old] to [new] -- costs, mistakes, timeline. AMA."
- "Reviewed 50 [category] tools -- here's my decision framework. AMA."
- "Went from X to Y in Z days -- what we'd repeat and avoid. AMA."

### r/SaaS Post Template

- Title: "We reduced [metric] by X% changing [one thing] -- exact flow here"
- Body: 5-8 bullets (context -> change -> results -> failures -> peer question)

---

## 10. Tracking & Attribution

### UTM Tag Structure

```
?utm_source=reddit&utm_medium=comment&utm_campaign=r_{subreddit_name}
```

Variants: medium = comment | thread | profile

### Daily Log Requirements

Subreddit name, Thread URL, Identified pain point, Comment link, Outcome type (reply/DM/call/signup)

### Tracker Template

| Subreddit | Thread URL | Intent Score (1-5) | Comment Posted | Replies | Upvotes | DMs | Email Signups | Revenue | Minutes Spent |

### Weekly KPI Targets

| Metric | Beginner | Scale |
|--------|----------|-------|
| Qualified threads reviewed | 25/week | 60/week |
| Comments posted | 10/week | 20/week |
| DM conversations | 3/week | 5/week |
| Calls booked | 1/week | 3/week |
| Reply-to-positive rate | 15-30% | 15-30% |
| DM-to-demo rate | 5-15% | 10-25% |
| Cost per lead | $50-100 | $50-100 |

### Content Ratio Tracking

Monitor 90/10 compliance (value vs. promotion ratio).

---

## 11. Platform Stats & Benchmarks

### Reddit Platform Stats (2025-2026)

These stats underpin the market sizing in [[reddit-market]]:

- 108M+ daily active users (50.1M US, 58M intl)
- 500M+ monthly visitors
- 1.1B+ registered accounts
- 100,000+ active communities
- ~1.2M comments daily
- 20+ min average session duration (4.5x LinkedIn)
- 74% of users say Reddit influences purchase decisions
- 90% trust Reddit for product discovery
- Reddit appears in 97.5% of product review Google queries
- Reddit cited in 40.11% of AI-generated responses
- Q2 2025 ad revenue: $465M (+84% YoY)
- Reddit ad revenue total: $1B+ (2024), projected $1.5B+ (2026)

### Cost Benchmarks

- Reddit CPC (B2B/SaaS): $0.50-$2.00
- vs LinkedIn: 70-85% cheaper
- vs Facebook/Instagram: 50-70% cheaper
- Organic lead cost: $50-100 per lead
- Organic conversion rate: 3-5%
- Paid CTR: 0.2-0.42%
- 80% of SaaS companies banned within first month

### Case Study Results

| Company | Results | Timeline |
|---------|---------|----------|
| Narrative Nooks (EdTech) | 139 leads, $980 revenue, 30 customers | 30 days |
| Speeddough | 120 leads, $1,800 revenue, 150% signup lift | 45 days |
| Owledge.io | 29 leads, $1,020 revenue | 60 days |
| Rise Vision | 6x ROAS, 77% lower CPL, 63% lower cost-per-signup | 4 months |
| Storytel AMA | 3.4x ad awareness, 266% video completion | Single AMA |
| InterTeam | 218% conversion lift, 25% more MQLs | Campaign |
| Cybersecurity SaaS | 500 subs, 120 leads, 42% demo conversion, 3x ROI vs LinkedIn | 6 months |
| ADHD Coaching | $280k direct sales/year, #1 on ChatGPT | Ongoing |
| EIT Campus | 492% traffic increase, 46K clicks, 16.7M impressions | 3 months |
| M&M Food Market | 72% more efficient CPA, 59% more efficient CPC | Campaign |
| Liquid I.V. | 94% reduction in cost per action | Campaign |
| Adobe r/photoshop | 250K visits, ~$1.2M attributed revenue | Ongoing |

### KPI Targets

- Coverage: 20-50 threads/week
- Speed: <2 hours to first reply (hot keywords)
- Engagement: 3-10% comment-to-DM rate
- Conversion: 10-25% DM-to-demo rate
- Permission-based DMs: 3-10x higher conversion than cold outreach

---

## 12. Community Graph & Splinter Detection

### Splinter Detection Framework

**Signals:**
- Activity velocity
- User overlap %
- Divergence rate over time

**Confirmation:** "Overlap drops while activity rises" = users choosing sides

**Stability:** Cluster membership consistent over multiple 30-day windows = trust signal

### Four-Step Community Mapping

1. Select seed set (10-30 subreddits)
2. Collect weekly signals: top posts, comment velocity, unique authors, shared domains, user overlap
3. Define splinter thresholds: fast growth + >=X% shared authors with parent + subsequent overlap decline
4. Two-phase engagement: contribute in bridge subs first, then target splinter

### Relationship Signal Types

| Signal | Best For | Calculation |
|--------|----------|-------------|
| User migration/overlap | Splinter detection | % commenters in both subs within time window |
| Shared domains | Product/category research | Overlap in outbound links |
| Cross-posting | Meme/news propagation | Content sharing frequency |
| Semantic similarity | Sparse user overlap | Embeddings of titles/comments |

### Bridge Sub vs. Splinter Sub Strategy

- Bridge subs: overlap zones for norm-learning and ban avoidance
- Splinter subs: stabilized fractures with specific pain points; tailor messaging
- Splinters concentrate higher-intent audiences: "sharper pain points, clearer norms, higher conversion potential"

---

## 13. AI Content Guardrails

- Use AI for outlines only
- Add lived details: screenshots, real metrics, actual mistakes
- Include founder voice; avoid generic tone
- Optimize for quotable specifics
- Unlabeled AI content will feel "socially awkward" in tight communities

### AI-Assisted Workflow

1. Use AI for internal summarization + pain-point extraction only
2. Draft 2-3 reply options via AI, rewrite in authentic voice
3. Personalize with 1-2 thread-specific details
4. Always disclose affiliation when product mentioned

### What's Safe to Automate

- Thread discovery + filtering by keyword/subreddit/intent
- Rule highlighting before posting
- Outcome logging (reply link, date, conversion result)
- Subreddit norm analysis + tone guidance

### What's Risky to Automate

- Reply generation (must be manually edited)
- Account management at scale
- Upvoting/voting coordination
- Cross-posting identical replies

These guardrails directly inform what [[SUPERREDDIT-PRODUCT-CONCEPT]] can and cannot automate — the safe-to-automate list maps to features we should build, while the risky list defines where we keep humans in the loop.

---

## 14. Execution Timelines

### 45-Minute System Launch

1. Pick 10 core + 20 adjacent subreddits
2. Create 7 alert setups (one per intent type)
3. Add 10 exclude keywords
4. Set response SLAs (60 min / 4 hr / 24 hr)
5. Build 3 reusable comment snippets
6. Track weekly metrics

### 7-Day Launch Sprint

- Day 1: Map 15 subreddits + rules + save 20 threads
- Day 2: 5 comments with framework (no links)
- Day 3: 5 more comments + 12-24hr reply guarantee
- Day 4: 1 value post (checklist/template, no CTA)
- Day 5: 1 optional resource link where fitting
- Day 6: Summarize top objections/phrases/pains
- Day 7: Plan AMA or review metrics

### 14-Day Sprint

- Days 1-2: Pick 12-20 pain keywords and 10-30 subreddits; create tracker; draft 3 "value blocks"
- Days 3-10: Comment on 1 high-intent thread/day; add 1 non-promotional comment; track metrics
- Days 11-14: Identify top 5 threads by engagement; write deeper follow-up; cull hostile subreddits

### 30-Day Execution Plan

- Week 1: Score 10 subreddits with RT formula, comment 1x daily, save 20 threads
- Week 2-3: 3-5 high-effort comments/week, add optional "permission" line, track weekly
- Week 4: Publish 1 value post, request mod approval for AMA, double-down on top 2 subreddits

### Expected 30-Day Outcomes

3-10 qualified leads + 1-3 sales calls + identification of 2-3 subreddits driving 80% of results

---

## Platform Risk Diversification

### Pipeline Fragility Score

```
Platform-Sourced Pipeline % = (Pipeline $ from Platform X / Total Pipeline $) x 100
Platform Dependency Risk = Platform-Sourced Pipeline % x (1 - Owned Capture Rate)
```

**Threshold**: No single platform should exceed 25% dependency risk.

### 30-Day Channel Diversification Sprint

- Week 1: Map 3 rented channels + 2 owned assets
- Week 2: Launch email opt-in CTA; create lead magnet (3-5 pages)
- Week 3: Reddit: 10 subreddits + 3 comments/day x 10 days
- Week 4: 1 recurring owned event + weekly channel review