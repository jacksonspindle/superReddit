/**
 * Signal detector: searches Reddit, filters by keywords, classifies intent via LLM, upserts signals.
 */

import { searchSubredditPosts } from '@/lib/reddit/fetcher';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';
import { INTENT_CLASSIFY_SYSTEM_PROMPT, buildIntentClassifyPrompt } from '@/lib/ai/prompts';
import { computeCombinedScore } from '@/lib/outreach/scoring';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedditPost } from '@/types';

interface DetectOptions {
  projectId: string;
  keywords: string[];
  competitors: string[];
  subreddits: string[];
  subredditLimit: number;
  productName: string;
  productDescription: string;
}

interface ClassifiedPost {
  reddit_id: string;
  intent_type: string;
  intent_score: number;
}

async function classifyPosts(
  posts: RedditPost[],
  productName: string,
  productDescription: string
): Promise<ClassifiedPost[]> {
  if (posts.length === 0) return [];

  const client = getAnthropicClient();
  const prompt = buildIntentClassifyPrompt(posts, productName, productDescription);

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: MAX_TOKENS,
    system: INTENT_CLASSIFY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  let responseText = textContent.text.trim();
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(responseText) as { classifications: ClassifiedPost[] };
    return parsed.classifications || [];
  } catch {
    return [];
  }
}

function matchesKeywords(post: RedditPost, keywords: string[]): string[] {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  return keywords.filter((kw) => text.includes(kw.toLowerCase()));
}

function mentionsCompetitor(post: RedditPost, competitors: string[]): boolean {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  return competitors.some((comp) => text.includes(comp.toLowerCase()));
}

export async function detectSignals(
  supabase: SupabaseClient,
  options: DetectOptions
): Promise<number> {
  const { projectId, keywords, competitors, subreddits, subredditLimit, productName, productDescription } = options;

  // 1. Search Reddit across subreddits for keyword matches
  const allPosts: RedditPost[] = [];
  const limitPerSub = Math.min(25, Math.ceil(subredditLimit / Math.max(1, subreddits.length)));

  for (const sub of subreddits.slice(0, 10)) {
    for (const keyword of keywords.slice(0, 5)) {
      const result = await searchSubredditPosts(sub, keyword, limitPerSub);
      if (result.posts) {
        allPosts.push(...result.posts);
      }
    }
  }

  // Deduplicate by reddit_id
  const uniquePosts = new Map<string, RedditPost>();
  for (const post of allPosts) {
    if (!uniquePosts.has(post.id)) {
      uniquePosts.set(post.id, post);
    }
  }

  const postsToClassify = Array.from(uniquePosts.values());
  if (postsToClassify.length === 0) return 0;

  // 2. Classify intent via LLM (batch up to 20 at a time)
  const batch = postsToClassify.slice(0, 20);
  const classifications = await classifyPosts(batch, productName, productDescription);
  const classMap = new Map(classifications.map((c) => [c.reddit_id, c]));

  // 3. Upsert signals
  const signals = batch.map((post) => {
    const classification = classMap.get(post.id);
    const intentScore = classification?.intent_score ?? 0.3;
    const matchedKws = matchesKeywords(post, keywords);
    const compMentioned = mentionsCompetitor(post, competitors);

    return {
      project_id: projectId,
      reddit_id: post.id,
      subreddit: post.subreddit,
      title: post.title,
      body: post.selftext || null,
      author: post.author,
      score: post.score,
      num_comments: post.num_comments,
      permalink: post.permalink,
      created_utc: post.created_utc,
      intent_type: classification?.intent_type ?? 'unknown',
      intent_score: intentScore,
      combined_score: computeCombinedScore(intentScore, post.created_utc, post.score, post.num_comments),
      matched_keywords: matchedKws,
      competitor_mentioned: compMentioned,
      status: 'new',
      fetched_at: new Date().toISOString(),
    };
  });

  if (signals.length > 0) {
    await supabase
      .from('outreach_signals')
      .upsert(signals, { onConflict: 'project_id,reddit_id' });
  }

  return signals.length;
}
