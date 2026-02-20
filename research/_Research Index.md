---
tags:
  - MOC
aliases:
  - Research Index
  - Research Hub
date: 2026-02-19
category: index
status: active-research
---

# SuperReddit Research Index

## 1. Overview

This vault contains competitive intelligence, market research, product strategy, and technical implementation research for SuperReddit — a Reddit marketing platform. Files are organized into four clusters below. Use Obsidian's graph view to explore connections.

## 2. SuperX Competitor Analysis

These files dissect SuperX (the leading competitor) across product, tech, growth, and user sentiment:

- [[product-analysis]] — Feature breakdown, pricing tiers, and competitive positioning
- [[tech-analysis]] — Chrome extension architecture, DOM scraping, API usage
- [[growth-strategy]] — Marketing channels, content strategy, viral loops
- [[customer-testimonials]] — User reviews, feature requests, sentiment analysis

## 3. Reddit Competitor Intelligence

Analysis of other tools in the Reddit marketing space:

- [[crowdreply-deep-dive]] — Browser automation approach, auto-reply risks
- [[mediafast-analysis]] — Content scheduling, ban prevention features
- [[subreddit-signals-blog-extraction]] — 55-post knowledge extraction, outreach frameworks

## 4. Market & Strategy

Market sizing, product vision, and go-to-market:

- [[reddit-market]] — Reddit API landscape, market opportunity, user personas
- [[SUPERREDDIT-PRODUCT-CONCEPT]] — Master product concept and vision (most connected file)
- [[outreach-implementation-plan]] — Feature implementation plan from Subreddit Signals intel
- [[reddit-post-styles]] — 12 post archetypes / Writing DNA for AI content generation

## 5. Technical Implementation

Architecture decisions, API alternatives, and feature designs:

- [[reddit-without-api-approaches]] — 8 approaches to access Reddit data without API
- [[dm-feature-research]] — DM workflow design, thread monitoring, cadence rules
- [[chrome-extension-dm-bridge]] — Chrome extension architecture for DM sending
- [[create-post-flow]] — Safe copy-paste posting flow to avoid shadow bans

## 6. Key Themes

Cross-cutting themes to explore via Obsidian tags:

- **Ban Safety** `#ban-safety` — Shadow ban prevention runs through create-post-flow, dm-feature-research, subreddit-signals-blog-extraction, crowdreply-deep-dive
- **Reddit API Constraints** `#reddit-api` — API limitations shape our entire technical approach
- **Chrome Extension** `#chrome-extension` — Browser extension is key to DM sending and data access
- **Content Strategy** `#content-strategy` — Post styles, outreach frameworks, engagement patterns
- **Competitor Intel** `#competitor/superx` `#competitor/crowdreply` `#competitor/mediafast` `#competitor/subreddit-signals` — Four competitors analyzed
- **Product Strategy** `#product-strategy` — Product concept, pricing, positioning

## 7. Reading Order (Suggested)

For someone new to this research:

1. Start with [[reddit-market]] for market context
2. Read the SuperX cluster: [[product-analysis]] → [[tech-analysis]] → [[growth-strategy]] → [[customer-testimonials]]
3. Review competitors: [[crowdreply-deep-dive]] → [[mediafast-analysis]] → [[subreddit-signals-blog-extraction]]
4. Understand the vision: [[SUPERREDDIT-PRODUCT-CONCEPT]]
5. Dive into implementation: [[outreach-implementation-plan]] → [[reddit-post-styles]] → [[reddit-without-api-approaches]] → [[dm-feature-research]] → [[chrome-extension-dm-bridge]] → [[create-post-flow]]
