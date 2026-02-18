# Create Post Flow — Research & Implementation Plan

## Context

Okara (@askOkara), an agentic Reddit tool, publicly removed their agent-based commenting feature on 2/17/26 because **Reddit shadow bans accounts that use external tools to post**. Their tool was programmatically submitting posts/comments via Reddit's API or browser automation on behalf of users, which Reddit detected and penalized.

> "we removed the agent based commenting because reddit shadow bans accounts that use external tools to post."
> — @askOkara, 2/17/26

## What Gets You Shadow Banned

- Calling Reddit's API to create posts/comments programmatically
- Browser automation (Puppeteer, Selenium) submitting forms
- Any programmatic submission on behalf of a user
- Reddit detects these via API tokens, user-agent strings, request patterns, and `isTrusted` event flags

## What Does NOT Get You Shadow Banned

- Opening a Reddit URL (just browser navigation)
- Copying text to clipboard (Reddit has zero access to clipboard)
- User manually pasting content (`Cmd+V` / `Ctrl+V`)
- User manually clicking Submit/Post in Reddit's native UI

This is identical to someone writing a post in Google Docs, copying it, opening Reddit, and pasting it. Reddit cannot distinguish between these two scenarios.

## SuperReddit "Create Post" Flow

```
1. User writes/generates their post in SuperReddit
2. User picks the target subreddit
3. User clicks "Post to Reddit"
4. SuperReddit copies the title + body to clipboard (automatic)
5. SuperReddit opens reddit.com/r/{subreddit}/submit in a new tab (automatic)
6. User pastes and hits Post (manual — two keystrokes)
```

### What's automatic (handled by SuperReddit):
- Copy formatted content to clipboard
- Open `https://www.reddit.com/r/{subreddit}/submit` in a new browser tab

### What's manual (user does in Reddit's native UI):
- Paste content (`Cmd+V`)
- Click Post

## Why This Is Safe

| Signal | Detectable? | Why |
|--------|------------|-----|
| Clipboard contents | No | Reddit has no access to clipboard |
| Where text was written before paste | No | Indistinguishable from any text editor |
| Opening a URL to Reddit | No | Same as clicking any link/bookmark |
| User pasting content | No | `Cmd+V` produces a trusted browser event |
| User clicking Submit | No | Real user interaction in Reddit's own UI |

## What To Avoid

- **DO NOT** auto-fill Reddit's form fields via extension/script (detectable via `isTrusted: false` on events)
- **DO NOT** programmatically click the Submit/Post button
- **DO NOT** use Reddit's API to create posts on behalf of users
- **DO NOT** use URL query params to pre-fill the form (`?title=...&selftext=...`) — while probably safe, it creates a fingerprintable pattern across users

## Competitive Advantage

Okara had to **remove** their posting feature entirely. SuperReddit's copy-paste + open-URL approach is shadow-ban-safe by design because the tool never touches Reddit for submission. We are a content preparation tool, not a posting automation tool. The user always has final control.

## Risks (Content/Behavior, Not Tool-Related)

The only shadow ban risks are user-behavior-driven, not caused by our tool:
- Posting too frequently (user behavior)
- Content that looks AI-generated or spammy (content quality)
- Sudden changes in posting patterns (account behavior)

These are the same risks any Reddit user faces regardless of what tool they use to draft content.
