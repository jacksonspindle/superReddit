# DM Feature Research — SuperReddit

> Research conducted 2026-02-14. Covers DM workflow design, Reddit API constraints, and implementation strategy.

---

## Table of Contents

1. [Core Insight](#1-core-insight)
2. [Safety Analysis](#2-safety-analysis)
3. [Reddit API Landscape (Nov 2025 Changes)](#3-reddit-api-landscape-nov-2025-changes)
4. [The No-OAuth DM Flow](#4-the-no-oauth-dm-flow)
5. [What We Can Automate Without OAuth](#5-what-we-can-automate-without-oauth)
6. [DM Workflow Manager Features](#6-dm-workflow-manager-features)
7. [Automation vs Manual Breakdown](#7-automation-vs-manual-breakdown)
8. [Pre-Filled Reddit DM URL](#8-pre-filled-reddit-dm-url)
9. [DB Schema for DM Tracking](#9-db-schema-for-dm-tracking)
10. [DM Templates & Cadence System](#10-dm-templates--cadence-system)
11. [Browser Extension Option (Future)](#11-browser-extension-option-future)
12. [Long-Term OAuth Path](#12-long-term-oauth-path)

---

## 1. Core Insight

Permission-based DMs convert **3-10x higher** than cold outreach (from Subreddit Signals blog research). DMs are the highest-value conversion channel for Reddit lead generation. SuperReddit should be a **DM workflow manager**, not a DM sender — the user always sends manually, we make the flow 10x faster and smarter.

---

## 2. Safety Analysis

### Absolutely NOT Safe (Will Get Accounts Banned)

- Auto-sending DMs via Reddit API
- Mass/bulk DM campaigns
- Cold DMs to users who didn't ask
- Scraping user profiles for DM targeting
- Any programmatic DM sending at scale

Reddit actively detects and bans accounts that send unsolicited DMs. Their API ToS explicitly prohibits it.

### Completely Safe

- Monitoring public threads for comment activity (public JSON)
- Generating DM drafts for the user to review
- Opening Reddit's native DM compose page via URL
- Tracking DM activity that the user manually logs
- User manually sending 5-10 DMs/day to people who commented on their posts

---

## 3. Reddit API Landscape (Nov 2025 Changes)

### Major Change: Self-Service API Access Ended

In November 2025, Reddit published the "Responsible Builder Policy" and ended self-service API key creation. All new OAuth applications require manual approval.

### New Process

1. Submit application via Reddit's Developer Support form
2. Describe use case, data needs, target subreddits, expected volume
3. Reddit targets 7-day response time
4. Manual review and approve/deny

### Commercial Approval Reality

- **Personal scripts/bots**: Rarely approved
- **Academic research**: Medium chance (needs ethics documentation)
- **Moderator tools**: More likely
- **Commercial use**: "Effectively impossible for most businesses unless you have an Enterprise-level budget (typically $10,000+ per month)"

Rejections come with minimal feedback. Enterprise commercial access starts at **$12,000+/year**, plus $0.24 per 1,000 API requests.

### What Still Works Without Approval

- **Public JSON endpoints**: Append `.json` to any Reddit URL for read-only access
- ~10 requests/minute, no credentials needed
- This is how SuperReddit's fetcher (`lib/reddit/fetcher.ts`) already works
- Covers all read-only needs: posts, comments, subreddit info, thread monitoring

### Sources

- [Reddit Developer Platform & Accessing Data](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data)
- [Reddit Killed Self-Service API Keys — Molehill.io](https://molehill.io/blog/reddit_killed_self-service_api_keys_your_options_for_automated_reddit_integration)
- [Reddit API Pricing 2026 — AutoGPT](https://autogpt.net/how-reddit-api-pricing-works/)
- [Reddit API Cost Guide — Rankvise](https://rankvise.com/blog/reddit-api-cost-guide/)

---

## 4. The No-OAuth DM Flow

The simplest and safest approach. No API approval needed.

### The Key Discovery

Reddit has a public URL for composing DMs with pre-filled parameters:

```
https://www.reddit.com/message/compose/?to=USERNAME&subject=SUBJECT&message=MESSAGE_BODY
```

No API, no OAuth, no approval. Opens Reddit's native DM compose page with recipient, subject, and message already filled in.

### The Exact User Flow

**Step 1:** User posts a reply or thread via SuperReddit (existing flow). We store that thread's permalink.

**Step 2:** We poll the thread's public JSON to detect new commenters:
```
GET https://www.reddit.com/{permalink}.json
```
Every new commenter gets auto-added as a "DM Ready" lead with their username, comment text, and context.

**Step 3:** User sees a list of commenters flagged as "DM Ready." Each card shows:
- Username
- What they commented
- AI-generated DM draft based on their comment + product context

**Step 4:** User clicks "Message." Opens in a new tab:
```
https://www.reddit.com/message/compose/?to=commenter_username&subject=Re: your comment about X&message=Hey, saw your comment about...
```
Reddit's DM page opens with everything pre-filled. User reviews, hits send. Done.

**Three clicks total:** Open the lead → Click "Message" → Hit send on Reddit.

---

## 5. What We Can Automate Without OAuth

### Permission/Comment Detection — Fully Automatic

When a user posts a reply to a signal thread, we know that thread's permalink. We poll the public JSON periodically to detect new commenters and DM-permission language:

**Permission patterns to detect:**
- "DM me"
- "send me that"
- "yes please"
- "can you share via DM"
- "would love that"
- "that would be helpful"
- OP replying to our user's comment positively

When detected, the signal card **automatically transitions** to "DM Ready" with a notification. No user action needed.

### Thread Monitoring — Fully Automatic

After a user posts a reply, we track that thread:
- Did OP respond? (engagement signal)
- Did the thread get more upvotes? (visibility signal)
- Did anyone else ask for help? (additional leads)
- Was the comment removed? (compliance alert)

All via public JSON polling. Run on a schedule — check active threads every 15-30 minutes.

### DM Draft Generation — Fully Automatic

The moment a commenter is detected, the DM draft auto-generates with:
- Reference to the specific thread ("Following up from your post about X in r/Y")
- Personalized based on their comment content + product context
- Compliance-checked against subreddit norms
- Ready for the user when they open the lead card

---

## 6. DM Workflow Manager Features

### Feature 1: Permission/Comment Detection
- Poll tracked threads for new commenters
- Flag commenters as "DM Ready" leads
- Detect explicit DM permission language
- Auto-transition lead status

### Feature 2: DM Draft Generator
- AI generates compliant DM based on thread context and commenter's comment
- Single purpose (address what they said)
- No pitch in first DM
- Reference the specific thread
- Soft close: "Let me know if you want me to walk through it"

### Feature 3: DM Template Library
Pre-built templates for common scenarios:
- Resource delivery ("Here's the checklist you asked about")
- Follow-up after helpful comment ("Wanted to share the full version")
- Qualification DM ("Quick q — what's your timeline/budget/stack?")
- Meeting bridge ("Easier to walk through live — want a 10-min call?")

### Feature 4: DM Tracker / Mini-CRM

| Field | Purpose |
|-------|---------|
| Reddit username | Who to DM |
| Source thread | Where the comment was |
| Comment text | What they said |
| DM draft | Pre-generated message |
| DM sent date | When user sent it |
| DM content | What was sent (audit trail) |
| Response received | Did they reply? |
| Outcome | Lead stage progression |
| Follow-up due | Next touch date |
| Touch number | Which touch in the cadence |

### Feature 5: "Copy & Open → Confirm" Flow

**Step 1:** User clicks "Send DM" button on a DM-ready lead
- DM text copies to clipboard
- Reddit DM compose URL opens in new tab (pre-filled)
- Lead auto-transitions to "DM Pending" state
- Timestamp recorded

**Step 2:** User reviews and sends on Reddit (5 seconds)

**Step 3:** User returns to SuperReddit tab. App detects tab regained focus, shows toast:
```
┌─────────────────────────────────┐
│  Did you send the DM to u/xyz?  │
│                                 │
│  [Yes, sent ✓]    [Not yet]     │
└─────────────────────────────────┘
```
One click. Lead moves to "DM Sent," follow-up timer starts.

### Feature 6: DM Cadence System (3-Touch Model)
- Touch 1 (within 2 hours): Deliver resource/answer + 1 qualifying question
- Touch 2 (24 hours, only if they responded): Offer deeper resource or call
- Touch 3 (72 hours): "Still relevant? Happy to help or close this out"
- Auto-stop after no response at Touch 3
- Follow-up reminders are fully automated

### Feature 7: Response Tracking — One Click
When user gets a Reddit notification that someone replied to their DM:
```
[Got a reply ✓]    [No response]    [Moved off-Reddit]
```
One click advances the pipeline stage.

---

## 7. Automation vs Manual Breakdown

| Step | Automated? | User Action |
|------|-----------|-------------|
| Signal detected | Fully auto | None |
| User posts reply in thread | Copy & paste | ~30 sec |
| Monitor thread for new commenters | Fully auto | None |
| Detect new commenters / DM permission | Fully auto | None |
| Generate DM draft | Fully auto | None |
| Notify user "Lead ready for DM" | Fully auto | None |
| Open pre-filled Reddit DM page | One click | Click "Message" |
| Review and send on Reddit | Manual | ~5 sec on Reddit |
| Confirm DM was sent | One click | "Yes, sent" toast |
| Set follow-up reminder (24hr) | Fully auto | None |
| Remind user to send Touch 2 | Fully auto | None |
| Log response received | One click | "Got a reply" |
| Advance pipeline stage | Fully auto | None |

**Total user effort per lead: 3 clicks + 1 review on Reddit.**
Everything else is automated using public JSON endpoints.

---

## 8. Pre-Filled Reddit DM URL

### URL Format
```
https://www.reddit.com/message/compose/?to=USERNAME&subject=SUBJECT&message=MESSAGE_BODY
```

### Example
```
https://www.reddit.com/message/compose/?to=john_doe&subject=Re%3A%20your%20comment%20about%20project%20management&message=Hey%20John%2C%20saw%20your%20comment%20about%20struggling%20with%20project%20tracking.%20I%20put%20together%20a%20quick%20checklist%20that%20might%20help...
```

### Notes
- URL-encode the subject and message parameters
- Works without any API access
- Opens Reddit's native compose UI
- User just reviews and clicks Send
- No automation — fully manual send via Reddit's own interface

---

## 9. DB Schema for DM Tracking

### New Table: `outreach_dms`

```sql
create table if not exists outreach_dms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  signal_id uuid references outreach_signals(id) on delete set null,
  reply_id uuid references outreach_replies(id) on delete set null,
  reddit_username text not null,
  source_thread_permalink text not null,
  commenter_comment_text text,
  permission_type text, -- 'comment_on_post', 'explicit_dm_request', 'positive_reply'
  permission_detected_at timestamptz,
  dm_draft text,
  dm_subject text,
  dm_sent_at timestamptz,
  touch_number integer default 1,
  response_received boolean default false,
  response_received_at timestamptz,
  follow_up_due timestamptz,
  pipeline_stage text default 'dm_ready',
    -- dm_ready | dm_pending | dm_sent | response_received | qualified | off_reddit | closed_won | closed_lost
  outcome text, -- 'converted', 'not_interested', 'no_response', 'wrong_fit'
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table outreach_dms enable row level security;

create policy "Users can manage their own outreach dms"
  on outreach_dms for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

create index if not exists idx_outreach_dms_project_stage on outreach_dms(project_id, pipeline_stage);
create index if not exists idx_outreach_dms_follow_up on outreach_dms(project_id, follow_up_due);

create trigger outreach_dms_updated_at
  before update on outreach_dms
  for each row execute function update_updated_at();
```

---

## 10. DM Templates & Cadence System

### Template: Resource Delivery (Touch 1)
```
Hey {username} — saw your comment about {topic} in r/{subreddit}.

I put together a {resource_type} that covers {specific_thing_they_mentioned}. Here's the quick version:

{2-3 bullet points of value}

Want me to send the full version? Also curious — {qualifying_question}?
```

### Template: Follow-Up After Helpful Comment (Touch 1)
```
Hey {username} — following up from the thread about {topic} in r/{subreddit}.

Wanted to share the full breakdown I mentioned: {resource_description}.

{1-2 actionable bullets}

Let me know if any of this is relevant to what you're working on.
```

### Template: Qualification DM (Touch 2)
```
Hey {username} — glad that was helpful!

Quick question so I can point you in the right direction: {qualifying_question about timeline/budget/stack}

No pressure either way — happy to help regardless.
```

### Template: Meeting Bridge (Touch 2)
```
Hey {username} — sounds like this is a bigger project than a DM can cover.

Would a quick 10-min call be easier? I can walk through {specific_thing} and share some examples.

No deck, no pitch — just a sanity check. Want a link?
```

### Template: Close Loop (Touch 3)
```
Hey {username} — last ping on this. Still relevant, or should I close this out?

Either way, the {resource} I shared earlier is yours to keep. Good luck with {their_project}!
```

### Cadence Rules
- Touch 1: Within 2 hours of detection. Deliver value + 1 qualifying question.
- Touch 2: 24 hours after Touch 1, ONLY if they responded. Deeper resource or call offer.
- Touch 3: 72 hours after Touch 2. Binary close. Stop after no response.
- Auto-reminders at each stage.
- Auto-stop after Touch 3 with no response (mark as "no_response").

---

## 11. Browser Extension Option (Future)

A lightweight Chrome extension could make the entire flow fully automated:

- Detects when user is on `reddit.com/message/compose` or `reddit.com/message/messages`
- Auto-confirms DM was sent when it sees the success state
- Reads incoming DM notifications and syncs to SuperReddit
- All via DOM observation — no Reddit API needed

This would eliminate the "Did you send it?" confirmation step and auto-detect responses, making the pipeline 100% automated. Worth considering as a v2 after the core DM workflow is proven.

---

## 12. Long-Term OAuth Path

If SuperReddit scales and can justify the cost:

1. Apply for Reddit's commercial API access ($12,000+/year)
2. If approved, request `privatemessages` scope
3. Build full in-app DM inbox: read, compose, send, track
4. All without leaving SuperReddit
5. Pipeline auto-progression based on actual DM state

### OAuth Technical Architecture (Future Reference)
```
User connects Reddit account
        ↓
OAuth flow → store refresh_token (encrypted) in DB
        ↓
New table: reddit_connections
  (user_id, reddit_username, access_token, refresh_token,
   scopes, token_expires_at, created_at)
        ↓
DM features use the stored token to make API calls
on behalf of the authenticated user
```

### Reddit API Endpoints (Future Reference)

| Endpoint | Purpose |
|----------|---------|
| `GET /message/inbox` | Read incoming DMs |
| `GET /message/sent` | Read sent DMs |
| `POST /api/compose` | Send a new DM |
| `POST /api/read_message` | Mark as read |
| `GET /message/unread` | Unread count for notifications |

Rate limit: ~60 requests/min per authenticated user.

---

## Competitive Landscape

No competitor has Reddit OAuth DM access either. Everyone uses copy-paste workflows:
- **Subreddit Signals**: Copy & open thread, manual DM
- **Reddinbox**: Similar workflow manager approach
- **GummySearch**: No DM features
- **ReplyAgent**: Posts comments only, no DM management

A well-built DM workflow manager with automated permission detection, draft generation, and pipeline tracking would be a significant differentiator — even without OAuth.

---

## Key Takeaway

The pre-filled Reddit DM URL (`/message/compose/?to=...&subject=...&message=...`) is the unlock. Combined with automated thread monitoring for new commenters and AI-generated drafts, we can build a DM pipeline that's:

- **Zero API risk** (no OAuth needed)
- **Nearly fully automated** (3 clicks per lead)
- **Better than competitors** (none have this level of DM workflow)
- **Compliant with Reddit ToS** (user sends manually via Reddit's own UI)
- **Upgradeable** (add OAuth later if budget allows)
