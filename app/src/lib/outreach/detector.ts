/**
 * Signal detector: two-tier detection system.
 * Tier 1: Regex pattern matching (zero AI cost) — filters posts scoring >= 3/10.
 * Tier 2: AI classification via Haiku 4.5, with Sonnet fallback for ambiguous results.
 * V2: When product context is available, uses multi-dimensional scoring (Fit/Lead/Engage).
 * Background polling uses batch API; manual "Scan Now" uses real-time API.
 */

import { searchMultiSubPosts } from '@/lib/reddit/fetcher';
import { tier1Score, findCompetitorMentions } from '@/lib/outreach/signal-patterns';
import {
  classifyPostsRealtime,
  reclassifyWithSonnet,
  classifyPostsV2,
  type ClassificationInput,
  type ClassificationResult,
  type ClassificationResultV2,
} from '@/lib/outreach/signal-classifier';
import { computeEnhancedScore, computeV2CombinedScore, deriveLeadTier } from '@/lib/outreach/scoring';
import * as pullpush from '@/lib/reddit/pullpush';
import { buildCacheKey, getCachedSearch, setCachedSearch } from '@/lib/reddit/cache';
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
  /** If true, uses real-time API (manual scan). If false, simpler scoring. */
  realtime?: boolean;
  /** Product context for V2 classification */
  productContext?: {
    problemsSolved: string[];
    solutionFeatures: string[];
    audienceBehaviors: string[];
    competitorWeaknesses: string[];
  };
  /** Time filter for Reddit search (default 'week') */
  timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  /** Max total results to fetch (default 100) */
  maxResults?: number;
  /** Whether to include PullPush comment search (default true) */
  includeComments?: boolean;
}

const TIER1_THRESHOLD = 3; // Minimum Tier 1 score to proceed to AI classification
const BATCH_SIZE = 20; // Max posts to classify per AI call

/**
 * Run the full two-tier detection pipeline.
 */
export async function detectSignals(
  supabase: SupabaseClient,
  options: DetectOptions
): Promise<number> {
  const {
    projectId,
    keywords,
    competitors,
    subreddits,
    productName,
    productDescription,
    realtime = true,
    productContext,
    timeFilter = 'week',
    maxResults = 100,
    includeComments = true,
  } = options;

  // 1. Search Reddit across subreddits using multi-sub + OR-grouped keywords
  //    Also search PullPush for comments in parallel
  const cacheKey = buildCacheKey(subreddits, keywords, timeFilter, 'reddit');
  const commentCacheKey = buildCacheKey(subreddits, keywords, timeFilter, 'pullpush');

  // Check L2 shared cache first
  let cachedPosts = await getCachedSearch(supabase, cacheKey);
  let cachedCommentPosts = await getCachedSearch(supabase, commentCacheKey);

  // Fetch from APIs if not cached
  const fetchPromises: Promise<void>[] = [];

  if (!cachedPosts) {
    fetchPromises.push(
      searchMultiSubPosts(subreddits, keywords, {
        timeFilter,
        limit: maxResults,
        maxPages: 3,
      }).then(async (result) => {
        cachedPosts = result.posts;
        // Write to L2 cache
        await setCachedSearch(supabase, cacheKey, cachedPosts, 'reddit');
      })
    );
  }

  if (includeComments && !cachedCommentPosts) {
    fetchPromises.push(
      pullpush
        .searchComments({
          subreddits,
          query: keywords.join(' OR '),
          after: timeFilterToUnix(timeFilter),
          limit: 100,
        })
        .then(async (comments) => {
          // Map PullPush comments to RedditPost-shaped objects for unified processing
          cachedCommentPosts = comments.map((c) => ({
            id: c.id,
            title: '', // comments don't have titles
            selftext: c.body,
            author: c.author,
            score: c.score,
            num_comments: 0,
            url: `https://www.reddit.com${c.permalink}`,
            permalink: c.permalink,
            created_utc: c.created_utc,
            subreddit: c.subreddit,
            link_flair_text: null,
            is_self: true,
            thumbnail: null,
            preview_url: null,
            post_hint: null,
            // Extra fields stored for signal row creation
            _is_comment: true,
            _parent_post_id: c.link_id?.replace('t3_', '') || null,
          }));
          await setCachedSearch(supabase, commentCacheKey, cachedCommentPosts, 'pullpush');
        })
    );
  }

  if (fetchPromises.length > 0) {
    await Promise.all(fetchPromises);
  }

  // Merge posts and comments, deduplicate by ID
  const uniquePosts = new Map<string, RedditPost & { _is_comment?: boolean; _parent_post_id?: string | null }>();
  for (const post of cachedPosts || []) {
    if (!uniquePosts.has(post.id)) {
      uniquePosts.set(post.id, post);
    }
  }
  for (const comment of cachedCommentPosts || []) {
    if (!uniquePosts.has(comment.id)) {
      uniquePosts.set(comment.id, comment as RedditPost & { _is_comment?: boolean; _parent_post_id?: string | null });
    }
  }

  const postsToProcess = Array.from(uniquePosts.values());
  if (postsToProcess.length === 0) return 0;

  // 2. Tier 1: Regex scoring
  const tier1Results = postsToProcess.map((post) => ({
    post,
    tier1: tier1Score(post.title, post.selftext),
    competitorMentions: findCompetitorMentions(
      `${post.title} ${post.selftext}`,
      competitors
    ),
  }));

  // Split into those that need AI (score >= 3) and those that don't
  const needsAI = tier1Results.filter((r) => r.tier1.score >= TIER1_THRESHOLD);

  // 3. Tier 2: AI classification
  let aiClassifications = new Map<string, ClassificationResult>();
  let v2Classifications = new Map<string, ClassificationResultV2>();
  const useV2 = !!productContext;

  if (needsAI.length > 0 && realtime) {
    const classificationInputs: ClassificationInput[] = needsAI
      .slice(0, BATCH_SIZE)
      .map((r) => ({
        reddit_id: r.post.id,
        title: r.post.title,
        body: r.post.selftext || null,
        subreddit: r.post.subreddit,
        author: r.post.author,
        score: r.post.score,
        num_comments: r.post.num_comments,
      }));

    if (useV2) {
      // V2: Product-context-aware multi-dimensional classification
      const results = await classifyPostsV2(
        classificationInputs,
        {
          productName,
          productDescription,
          problemsSolved: productContext.problemsSolved,
          solutionFeatures: productContext.solutionFeatures,
          audienceBehaviors: productContext.audienceBehaviors,
          competitors,
          competitorWeaknesses: productContext.competitorWeaknesses,
        }
      );

      for (const r of results) {
        v2Classifications.set(r.reddit_id, r);
      }
    } else {
      // V1: Original classification pipeline
      const results = await classifyPostsRealtime(
        classificationInputs,
        productName,
        productDescription,
        competitors
      );

      for (const r of results) {
        aiClassifications.set(r.reddit_id, r);
      }

      // 4. Sonnet fallback for ambiguous results (medium bin)
      const ambiguous = results.filter((r) => r.score_bin === 'medium');
      if (ambiguous.length > 0) {
        const ambiguousInputs = classificationInputs.filter((i) =>
          ambiguous.some((a) => a.reddit_id === i.reddit_id)
        );

        const sonnetResults = await reclassifyWithSonnet(
          ambiguousInputs,
          productName,
          productDescription,
          competitors
        );

        for (const r of sonnetResults) {
          aiClassifications.set(r.reddit_id, r);
        }
      }
    }
  }

  // 5. Build signal rows
  const signals = tier1Results.map((r) => {
    const v2Result = v2Classifications.get(r.post.id);
    const aiResult = aiClassifications.get(r.post.id);
    const hasV2 = !!v2Result;
    const hasAI = !!aiResult;

    let intentScore: number;
    let intentType: string;
    let signalTypes: string[];
    let painSeverity: string | null;
    let decisionMaker: boolean;
    let fitScore: number | null = null;
    let leadScore: number | null = null;
    let engageScore: number | null = null;
    let leadTier: string | null = null;
    let combinedScore: number;

    if (hasV2) {
      fitScore = v2Result.fit_score;
      leadScore = v2Result.lead_score;
      engageScore = v2Result.engage_score;
      leadTier = deriveLeadTier(fitScore, leadScore);
      combinedScore = computeV2CombinedScore(fitScore, leadScore, engageScore);
      intentScore = combinedScore;
      intentType = v2Result.intent_type;
      signalTypes = v2Result.signal_types;
      painSeverity = v2Result.pain_severity;
      decisionMaker = v2Result.decision_maker;
    } else if (hasAI) {
      intentScore = aiResult.intent_score;
      intentType = aiResult.intent_type;
      signalTypes = aiResult.signal_types;
      painSeverity = aiResult.pain_severity;
      decisionMaker = aiResult.decision_maker;
      combinedScore = computeEnhancedScore({
        intentScore,
        createdUtc: r.post.created_utc,
        redditScore: r.post.score,
        numComments: r.post.num_comments,
        competitorMentioned: r.competitorMentions.length > 0,
        switchingIntent: aiResult.competitor_mentions.some((c) => c.switching_intent),
      });
    } else {
      intentScore = Math.min(1, r.tier1.score / 10);
      intentType = r.tier1.signalTypes.length > 0 ? r.tier1.signalTypes[0] : 'unknown';
      signalTypes = r.tier1.signalTypes;
      painSeverity = null;
      decisionMaker = false;
      combinedScore = computeEnhancedScore({
        intentScore,
        createdUtc: r.post.created_utc,
        redditScore: r.post.score,
        numComments: r.post.num_comments,
        competitorMentioned: r.competitorMentions.length > 0,
      });
    }

    return {
      project_id: projectId,
      reddit_id: r.post.id,
      subreddit: r.post.subreddit,
      title: r.post.title,
      body: r.post.selftext || null,
      author: r.post.author,
      score: r.post.score,
      num_comments: r.post.num_comments,
      permalink: r.post.permalink,
      created_utc: r.post.created_utc,
      intent_type: intentType,
      intent_score: intentScore,
      combined_score: combinedScore,
      matched_keywords: keywords.filter((kw) =>
        `${r.post.title} ${r.post.selftext}`.toLowerCase().includes(kw.toLowerCase())
      ),
      competitor_mentioned: r.competitorMentions.length > 0,
      signal_types: signalTypes,
      pain_severity: painSeverity,
      decision_maker: decisionMaker,
      is_comment: !!(r.post as unknown as { _is_comment?: boolean })._is_comment,
      parent_post_id: ((r.post as unknown as { _parent_post_id?: string | null })._parent_post_id) || null,
      discord_alert_status: 'pending',
      status: 'new',
      fetched_at: new Date().toISOString(),
      // V2 fields
      fit_score: fitScore,
      lead_score: leadScore,
      engage_score: engageScore,
      lead_tier: leadTier,
      is_unseen: true,
    };
  });

  // 6. Upsert signals with multi-level fallback for missing columns
  if (signals.length > 0) {
    const { error: upsertError } = await supabase
      .from('outreach_signals')
      .upsert(signals, { onConflict: 'project_id,reddit_id' });

    if (upsertError) {
      // Strip V2 columns (migration 011) and retry
      const withoutV2 = signals.map(({ fit_score, lead_score, engage_score, lead_tier, is_unseen, ...rest }) => rest);
      const { error: retryError } = await supabase
        .from('outreach_signals')
        .upsert(withoutV2, { onConflict: 'project_id,reddit_id' });

      if (retryError) {
        // Strip migration 010 columns too and retry with base-only fields
        const baseSignals = signals.map((s) => ({
          project_id: s.project_id,
          reddit_id: s.reddit_id,
          subreddit: s.subreddit,
          title: s.title,
          body: s.body,
          author: s.author,
          score: s.score,
          num_comments: s.num_comments,
          permalink: s.permalink,
          created_utc: s.created_utc,
          intent_type: s.intent_type,
          intent_score: s.intent_score,
          combined_score: s.combined_score,
          matched_keywords: s.matched_keywords,
          competitor_mentioned: s.competitor_mentioned,
          status: s.status,
          fetched_at: s.fetched_at,
        }));
        await supabase
          .from('outreach_signals')
          .upsert(baseSignals, { onConflict: 'project_id,reddit_id' });
      }
    }
  }

  // 7. Upsert competitor mentions (table may not exist — wrapped in try/catch)
  try {
    const competitorMentionRows: {
      project_id: string;
      signal_id: string | undefined;
      competitor_name: string;
      mention_context: string;
      sentiment: string;
      switching_intent: boolean;
    }[] = [];

    for (const r of tier1Results) {
      const v2Result = v2Classifications.get(r.post.id);
      const aiResult = aiClassifications.get(r.post.id);
      const mentions = v2Result?.competitor_mentions || aiResult?.competitor_mentions;

      if (mentions && mentions.length > 0) {
        for (const cm of mentions) {
          competitorMentionRows.push({
            project_id: projectId,
            signal_id: undefined,
            competitor_name: cm.name,
            mention_context: cm.context,
            sentiment: cm.sentiment,
            switching_intent: cm.switching_intent,
          });
        }
      } else if (r.competitorMentions.length > 0) {
        for (const cm of r.competitorMentions) {
          competitorMentionRows.push({
            project_id: projectId,
            signal_id: undefined,
            competitor_name: cm.name,
            mention_context: cm.context,
            sentiment: 'neutral',
            switching_intent: false,
          });
        }
      }
    }

    // Resolve signal IDs for competitor mentions
    if (competitorMentionRows.length > 0) {
      const redditIds = tier1Results
        .filter((r) =>
          r.competitorMentions.length > 0 ||
          aiClassifications.has(r.post.id) ||
          v2Classifications.has(r.post.id)
        )
        .map((r) => r.post.id);

      const { data: signalRows } = await supabase
        .from('outreach_signals')
        .select('id, reddit_id')
        .eq('project_id', projectId)
        .in('reddit_id', redditIds);

      const signalIdMap = new Map(
        (signalRows || []).map((s: { id: string; reddit_id: string }) => [s.reddit_id, s.id])
      );

      // Match competitor mentions to their signals
      let mentionIdx = 0;
      for (const r of tier1Results) {
        const v2Result = v2Classifications.get(r.post.id);
        const aiResult = aiClassifications.get(r.post.id);
        const mentions = v2Result?.competitor_mentions || aiResult?.competitor_mentions;
        const mentionCount = mentions
          ? mentions.length
          : r.competitorMentions.length;

        for (let i = 0; i < mentionCount && mentionIdx < competitorMentionRows.length; i++) {
          competitorMentionRows[mentionIdx].signal_id = signalIdMap.get(r.post.id);
          mentionIdx++;
        }
      }

      const validMentions = competitorMentionRows.filter((m) => m.signal_id);
      if (validMentions.length > 0) {
        await supabase.from('competitor_mentions').insert(validMentions);
      }
    }
  } catch {
    // competitor_mentions table may not exist yet — skip silently
  }

  return signals.length;
}

/** Convert a time filter string to a Unix timestamp (seconds) for PullPush `after` param. */
function timeFilterToUnix(timeFilter: string): number {
  const now = Math.floor(Date.now() / 1000);
  const durations: Record<string, number> = {
    hour: 3600,
    day: 86400,
    week: 7 * 86400,
    month: 30 * 86400,
    year: 365 * 86400,
    all: now, // effectively epoch 0
  };
  return now - (durations[timeFilter] || durations.week);
}
