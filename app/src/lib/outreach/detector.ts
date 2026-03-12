/**
 * Signal detector: two-tier detection system.
 * Tier 1: Regex pattern matching (zero AI cost) — filters posts scoring >= 3/10.
 * Tier 2: AI classification via Haiku 4.5, with Sonnet fallback for ambiguous results.
 * V2: When product context is available, uses multi-dimensional scoring (Fit/Lead/Engage).
 * Background polling uses batch API; manual "Scan Now" uses real-time API.
 */

import { searchMultiSubPosts, fetchSubredditPosts } from '@/lib/reddit/fetcher';
import { tier1Score, findCompetitorMentions, heuristicPreFilter } from '@/lib/outreach/signal-patterns';
import {
  classifyPostsRealtime,
  reclassifyWithSonnet,
  classifyPostsV2,
  preFilterPosts,
  classifyPostsV3,
  type ClassificationInput,
  type ClassificationResult,
  type ClassificationResultV2,
  type ClassificationResultV3,
} from '@/lib/outreach/signal-classifier';
import { computeEnhancedScore, computeV2CombinedScore, deriveLeadTier, computeV3CombinedScore, deriveLeadTierV3, computeV3CombinedScoreEnhanced, deriveLeadTierV3Enhanced } from '@/lib/outreach/scoring';
import * as pullpush from '@/lib/reddit/pullpush';
import { buildCacheKey, getCachedSearch, setCachedSearch } from '@/lib/reddit/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedditPost } from '@/types';

interface DetectOptions {
  projectId: string;
  keywords: string[];
  /** Map of keyword phrase → user-set tier (null = use heuristic) */
  keywordTiers?: Record<string, 'hot' | 'warm' | 'cold' | null>;
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

  // Invalidate cached empty results — they indicate a failed search, not "no data"
  if (cachedPosts && cachedPosts.length === 0) cachedPosts = null;
  if (cachedCommentPosts && cachedCommentPosts.length === 0) cachedCommentPosts = null;

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
        // Only cache non-empty results to avoid poisoning future scans
        if (cachedPosts.length > 0) {
          await setCachedSearch(supabase, cacheKey, cachedPosts, 'reddit');
        }
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

  console.log('[Detector] Reddit posts fetched:', cachedPosts?.length ?? 0, '| Comments fetched:', cachedCommentPosts?.length ?? 0);

  // Fallback: if keyword search returned 0 posts, browse subreddit new posts directly.
  // Uses multi-sub URL to fetch from all subreddits in a single request (fast).
  if ((!cachedPosts || cachedPosts.length === 0) && subreddits.length > 0) {
    console.log('[Detector] Keyword search returned 0 posts — falling back to browsing subreddit posts');
    try {
      const multiSub = subreddits.slice(0, 25).join('+');
      const result = await fetchSubredditPosts(multiSub, 'new', timeFilter, Math.min(maxResults, 100));
      cachedPosts = result.posts;
    } catch {
      cachedPosts = [];
    }
    console.log('[Detector] Fallback fetched', cachedPosts.length, 'posts from subreddit browsing');
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

    try {
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
    } catch (aiError) {
      // AI classification failed (e.g. out of credits) — continue with Tier 1 scores only
      console.warn('[Detector] AI classification failed, using Tier 1 scores only:', (aiError as Error).message);
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

// ---- V3 Detection Pipeline ----

interface DetectV3Options extends DetectOptions {
  /** Whether to browse all posts in monitored subreddits (default true) */
  browseSubreddits?: boolean;
  /** Pre-fetched Reddit posts from client (bypasses server-side Reddit IP blocks) */
  prefetchedPosts?: RedditPost[];
  /** Debug log array — push messages here for client-side debugging */
  _debugLog?: string[];
  /** Skip L2 cache and always fetch fresh from APIs */
  skipCache?: boolean;
  /** Streaming progress callback */
  onProgress?: (event: { step: string; message: string }) => void;
}

const PRE_FILTER_BATCH_SIZE = 150;
const V3_CLASSIFY_BATCH_SIZE = 100;

/** Determine lead tier from matched keywords: user-set tier wins, else word-count heuristic */
function resolveKeywordTier(
  matchedKeywords: string[],
  keywordTiers: Record<string, 'hot' | 'warm' | 'cold' | null>
): 'hot' | 'warm' | 'cold' {
  const tierRank = { hot: 0, warm: 1, cold: 2 } as const;
  let best: 'hot' | 'warm' | 'cold' = 'cold';

  for (const kw of matchedKeywords) {
    // Check user-set tier first
    const userTier = keywordTiers[kw.toLowerCase()];
    if (userTier) {
      if (tierRank[userTier] < tierRank[best]) best = userTier;
      continue;
    }
    // Heuristic: word count → specificity → tier
    const wordCount = kw.trim().split(/\s+/).length;
    const heuristic: 'hot' | 'warm' | 'cold' = wordCount >= 3 ? 'hot' : wordCount === 2 ? 'warm' : 'cold';
    if (tierRank[heuristic] < tierRank[best]) best = heuristic;
  }

  return best;
}

/**
 * V3 detection pipeline:
 * 1. Browse subreddits (free) + keyword search (free)
 * 2. Deduplicate against DB (only process new posts)
 * 3. Two-lane pre-filter:
 *    - Fast lane: heuristic keyword/competitor/regex match (free, instant)
 *    - Semantic lane: AI title screening for remaining posts (cheap, batched)
 * 4. Full 4-dimension AI classification on filtered posts
 * 5. Intent-boosted scoring (buyer_intent, urgency, pain, competitor switching)
 */
export interface DetectV3Result {
  count: number;
  totalFetched: number;
  alreadyExisting: number;
  newPosts: number;
  filtered: number;
  classified: number;
  fetchErrors?: string[];
}

export async function detectSignalsV3(
  supabase: SupabaseClient,
  options: DetectV3Options
): Promise<DetectV3Result> {
  const {
    projectId,
    keywords,
    keywordTiers = {},
    competitors,
    subreddits,
    productName,
    productDescription,
    productContext,
    timeFilter = 'week',
    maxResults = 100,
    includeComments = true,
    browseSubreddits = true,
    prefetchedPosts,
    skipCache = false,
  } = options;

  const _debugLog = options._debugLog || [];
  const dbg = (msg: string) => { console.log(msg); _debugLog.push(msg); };

  const usePrefetch = prefetchedPosts && prefetchedPosts.length > 0;
  const progress = options.onProgress || (() => {});
  const fetchErrors: string[] = [];

  dbg(`[DetectorV3] Starting. Subreddits: ${subreddits.join(', ')} | Keywords: ${keywords.join(', ')} | TimeFilter: ${timeFilter} | usePrefetch: ${usePrefetch}`);
  progress({ step: 'fetching', message: 'Fetching posts from Reddit...' });

  // ---- Fetch all sources in parallel ----
  // Primary: Reddit API via proxy (current data, reliable)
  // Supplementary: PullPush for comment search only (index is stale for posts)
  const browsedPosts = new Map<string, RedditPost & { _source?: string; _is_comment?: boolean; _parent_post_id?: string | null }>();

  const cacheKey = buildCacheKey(subreddits, keywords, timeFilter, 'reddit');
  const commentCacheKey = buildCacheKey(subreddits, keywords, timeFilter, 'pullpush');

  let cachedPosts = skipCache ? null : await getCachedSearch(supabase, cacheKey);
  let cachedCommentPosts = skipCache ? null : await getCachedSearch(supabase, commentCacheKey);

  if (cachedPosts && cachedPosts.length === 0) cachedPosts = null;
  if (cachedCommentPosts && cachedCommentPosts.length === 0) cachedCommentPosts = null;

  const fetchPromises: Promise<void>[] = [];

  // Source A: Browse subreddits via Reddit API (primary, via proxy)
  if (browseSubreddits && subreddits.length > 0 && !usePrefetch) {
    const multiSub = subreddits.slice(0, 25).join('+');
    dbg(`[DetectorV3] Source A: Browsing via Reddit API. Subs: ${multiSub}`);
    fetchPromises.push(
      fetchSubredditPosts(multiSub, 'new', timeFilter, Math.min(maxResults, 100))
        .then((result) => {
          dbg(`[DetectorV3] Source A: Reddit API returned ${result.posts.length} posts${result.error ? ` (error: ${result.error})` : ''}`);
          for (const post of result.posts) {
            if (!browsedPosts.has(post.id)) {
              browsedPosts.set(post.id, { ...post, _source: 'subreddit_browse' });
            }
          }
          if (result.posts.length === 0 && result.error) {
            fetchErrors.push(`Reddit browse: ${result.error}`);
          }
        })
        .catch((err) => {
          const msg = `Reddit browse failed: ${(err as Error).message}`;
          dbg(`[DetectorV3] Source A: ${msg}`);
          fetchErrors.push(msg);
        })
    );
  }

  // Source B: Keyword search via Reddit API (primary, via proxy)
  if (!cachedPosts && keywords.length > 0 && !usePrefetch) {
    dbg(`[DetectorV3] Source B: Keyword search via Reddit API. Keywords: ${keywords.join(', ')}`);
    fetchPromises.push(
      searchMultiSubPosts(subreddits, keywords, {
        timeFilter,
        limit: maxResults,
        maxPages: 3,
      }).then(async (result) => {
        dbg(`[DetectorV3] Source B: Reddit search returned ${result.posts.length} posts`);
        cachedPosts = result.posts;
        if (cachedPosts.length > 0 && !skipCache) {
          await setCachedSearch(supabase, cacheKey, cachedPosts, 'reddit');
        }
        if (result.posts.length === 0 && result.error) {
          fetchErrors.push(`Reddit search: ${result.error}`);
        }
      }).catch((err) => {
        const msg = `Reddit keyword search failed: ${(err as Error).message}`;
        dbg(`[DetectorV3] Source B: ${msg}`);
        fetchErrors.push(msg);
      })
    );
  }

  // Source C: Comment search via PullPush (supplementary — PullPush may be stale but comment search has no Reddit alternative)
  if (includeComments && !cachedCommentPosts && keywords.length > 0) {
    fetchPromises.push(
      pullpush
        .searchComments({
          subreddits,
          query: keywords.join(' OR '),
          after: timeFilterToUnix(timeFilter),
          limit: 100,
        })
        .then(async (comments) => {
          cachedCommentPosts = comments.map((c) => ({
            id: c.id,
            title: '',
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
            _is_comment: true,
            _parent_post_id: c.link_id?.replace('t3_', '') || null,
          }));
          if (!skipCache) {
            await setCachedSearch(supabase, commentCacheKey, cachedCommentPosts, 'pullpush');
          }
        })
        .catch((err) => {
          // PullPush comment search is supplementary — don't fail the whole scan
          dbg(`[DetectorV3] Source C: PullPush comment search failed (non-fatal): ${(err as Error).message}`);
        })
    );
  }

  if (fetchPromises.length > 0) {
    await Promise.all(fetchPromises);
  }

  dbg(`[DetectorV3] After fetches: browsed=${browsedPosts.size} keywordPosts=${cachedPosts?.length ?? 0} comments=${cachedCommentPosts?.length ?? 0} errors=${fetchErrors.length}`);

  // ---- Merge all sources, tag discovery_source ----
  const allPosts = new Map<string, RedditPost & { _source: string; _is_comment?: boolean; _parent_post_id?: string | null }>();

  if (usePrefetch) {
    // Use client-provided posts (client-side fetching bypasses datacenter IP blocks)
    for (const post of prefetchedPosts!) {
      allPosts.set(post.id, { ...post, _source: 'client_prefetch' });
    }
    console.log('[DetectorV3] Using', prefetchedPosts!.length, 'client-prefetched posts');
  } else {
    // Add browsed posts first
    for (const [id, post] of browsedPosts) {
      allPosts.set(id, post as RedditPost & { _source: string; _is_comment?: boolean; _parent_post_id?: string | null });
    }

    // Add keyword search posts, mark overlap
    for (const post of cachedPosts || []) {
      if (allPosts.has(post.id)) {
        // Found in both browse and keyword — mark as 'both'
        const existing = allPosts.get(post.id)!;
        existing._source = 'both';
      } else {
        allPosts.set(post.id, { ...post, _source: 'keyword_search' });
      }
    }
  }

  // Add comment posts (PullPush — different API, not blocked by Reddit)
  for (const comment of cachedCommentPosts || []) {
    if (!allPosts.has(comment.id)) {
      allPosts.set(comment.id, {
        ...(comment as RedditPost & { _is_comment?: boolean; _parent_post_id?: string | null }),
        _source: 'comment_search',
      });
    }
  }

  dbg(`[DetectorV3] After merge: allPosts=${allPosts.size}`);
  progress({ step: 'fetched', message: `Found ${allPosts.size} posts` });

  if (allPosts.size === 0) {
    dbg('[DetectorV3] No posts found from any source. Returning 0.');
    progress({ step: 'done', message: 'No posts found from any source' });
    return { count: 0, totalFetched: 0, alreadyExisting: 0, newPosts: 0, filtered: 0, classified: 0, fetchErrors: fetchErrors.length > 0 ? fetchErrors : undefined };
  }

  // ---- Deduplicate against DB ----
  const postIds = Array.from(allPosts.keys());
  let existingIds = new Set<string>();

  // Query in chunks of 200, run in parallel
  const dedupChunks: string[][] = [];
  for (let i = 0; i < postIds.length; i += 200) {
    dedupChunks.push(postIds.slice(i, i + 200));
  }
  const dedupResults = await Promise.all(
    dedupChunks.map((chunk) =>
      supabase
        .from('outreach_signals')
        .select('reddit_id')
        .eq('project_id', projectId)
        .in('reddit_id', chunk)
    )
  );
  for (const { data: existing } of dedupResults) {
    if (existing) {
      for (const row of existing) {
        existingIds.add(row.reddit_id);
      }
    }
  }

  const newPosts = Array.from(allPosts.values()).filter((p) => !existingIds.has(p.id));
  console.log('[DetectorV3] New posts after dedup:', newPosts.length, '(skipped', existingIds.size, 'existing)');
  progress({ step: 'dedup', message: `${newPosts.length} new posts to analyze` });

  if (newPosts.length === 0) {
    progress({ step: 'done', message: 'No new posts to analyze' });
    return { count: 0, totalFetched: allPosts.size, alreadyExisting: existingIds.size, newPosts: 0, filtered: 0, classified: 0, fetchErrors: fetchErrors.length > 0 ? fetchErrors : undefined };
  }

  // ---- Two-Lane Pre-Filter: Heuristic Fast-Pass + AI Semantic Filter ----
  // Lane 1 (free): Posts matching keywords/competitors/regex skip straight to classification
  // Lane 1b (free): Posts from keyword search auto-pass (PullPush already matched them)
  // Lane 2 (cheap): Remaining posts get AI title screening for semantic relevance
  const fastPassPosts: typeof newPosts = [];
  const needsAIFilter: typeof newPosts = [];

  for (const p of newPosts) {
    // Posts from keyword search auto-pass — PullPush already matched them to keywords
    if (p._source === 'keyword_search' || p._source === 'both') {
      fastPassPosts.push(p);
      continue;
    }

    const result = heuristicPreFilter(p.title, p.selftext, keywords, competitors);
    if (result.passed) {
      fastPassPosts.push(p);
    } else {
      needsAIFilter.push(p);
    }
  }

  console.log('[DetectorV3] Heuristic fast-pass:', fastPassPosts.length, '| Needs AI filter:', needsAIFilter.length);

  // AI semantic pre-filter on posts that didn't match heuristics
  const aiPassedPosts: typeof newPosts = [];
  if (needsAIFilter.length > 0) {
    try {
      const titleBatches: { index: number; title: string }[][] = [];
      for (let i = 0; i < needsAIFilter.length; i += PRE_FILTER_BATCH_SIZE) {
        titleBatches.push(
          needsAIFilter.slice(i, i + PRE_FILTER_BATCH_SIZE).map((p, j) => ({
            index: i + j,
            title: p.title || p.selftext?.slice(0, 100) || '',
          }))
        );
      }

      const passedIndices = new Set<number>();
      const batchResults = await Promise.all(
        titleBatches.map((batch) => preFilterPosts(batch, { productName, productDescription }).catch(() => [] as number[]))
      );
      for (const indices of batchResults) {
        for (const idx of indices) {
          passedIndices.add(idx);
        }
      }

      for (const idx of passedIndices) {
        if (idx < needsAIFilter.length) {
          aiPassedPosts.push(needsAIFilter[idx]);
        }
      }
      console.log('[DetectorV3] AI semantic filter passed:', aiPassedPosts.length, '/', needsAIFilter.length);
    } catch (preFilterErr) {
      // AI pre-filter failed — these posts are simply skipped (fast-pass posts still proceed)
      console.warn('[DetectorV3] AI pre-filter failed, skipping semantic lane:', (preFilterErr as Error).message);
    }
  }

  // Merge both lanes
  const filteredPosts = [...fastPassPosts, ...aiPassedPosts];
  console.log('[DetectorV3] Total posts for classification:', filteredPosts.length, '/', newPosts.length);

  if (filteredPosts.length === 0) {
    progress({ step: 'done', message: 'No relevant posts found after filtering' });
    return { count: 0, totalFetched: allPosts.size, alreadyExisting: existingIds.size, newPosts: newPosts.length, filtered: 0, classified: 0, fetchErrors: fetchErrors.length > 0 ? fetchErrors : undefined };
  }

  progress({ step: 'classifying', message: `Classifying ${filteredPosts.length} posts with AI...` });

  // ---- Full AI Classification (V3) ----
  const v3Classifications = new Map<string, ClassificationResultV3>();
  const productCtx = {
    productName,
    productDescription,
    problemsSolved: productContext?.problemsSolved,
    solutionFeatures: productContext?.solutionFeatures,
    audienceBehaviors: productContext?.audienceBehaviors,
    competitors,
    competitorWeaknesses: productContext?.competitorWeaknesses,
  };

  // Batch in groups of 100, run in parallel
  const classifyBatches: ClassificationInput[][] = [];
  for (let i = 0; i < filteredPosts.length; i += V3_CLASSIFY_BATCH_SIZE) {
    classifyBatches.push(
      filteredPosts.slice(i, i + V3_CLASSIFY_BATCH_SIZE).map((p) => ({
        reddit_id: p.id,
        title: p.title,
        body: p.selftext || null,
        subreddit: p.subreddit,
        author: p.author,
        score: p.score,
        num_comments: p.num_comments,
      }))
    );
  }

  const classifyResults = await Promise.all(
    classifyBatches.map((inputs) =>
      classifyPostsV3(inputs, productCtx).catch((err) => {
        console.warn('[DetectorV3] Classification batch failed:', (err as Error).message);
        return [] as ClassificationResultV3[];
      })
    )
  );
  for (const results of classifyResults) {
    for (const r of results) {
      v3Classifications.set(r.reddit_id, r);
    }
  }

  console.log('[DetectorV3] Classified', v3Classifications.size, 'posts');
  progress({ step: 'saving', message: `Saving ${v3Classifications.size} classified signals...` });

  // ---- Build signal rows ----
  // Normalize keyword tiers map to lowercase for matching
  const normalizedTiers: Record<string, 'hot' | 'warm' | 'cold' | null> = {};
  for (const [k, v] of Object.entries(keywordTiers)) {
    normalizedTiers[k.toLowerCase()] = v;
  }

  const signals = filteredPosts.map((post) => {
    const v3 = v3Classifications.get(post.id);
    const postSource = (post as { _source?: string })._source || 'keyword_search';

    const fitScore = v3?.fit_score ?? 5;
    const leadScore = v3?.lead_score ?? 3;
    const authenticityScore = v3?.authenticity_score ?? 5;
    const relevanceScore = v3?.relevance_score ?? 5;
    const buyerIntent = v3?.buyer_intent ?? 'problem_aware';
    const intentType = v3?.intent_type ?? 'discussion';
    const signalTypes = v3?.signal_types ?? [];
    const painSeverity = v3?.pain_severity ?? null;
    const decisionMaker = v3?.decision_maker ?? false;
    const urgency = v3?.urgency ?? 'none';
    const matchReason = v3?.match_reason ?? null;

    const competitorMentioned = (v3?.competitor_mentions?.length ?? 0) > 0;
    const switchingIntent = v3?.competitor_mentions?.some((c) => c.switching_intent) ?? false;

    const combinedScore = computeV3CombinedScoreEnhanced({
      fit: fitScore,
      lead: leadScore,
      authenticity: authenticityScore,
      relevance: relevanceScore,
      buyerIntent,
      decisionMaker,
      painSeverity,
      competitorMentioned,
      switchingIntent,
      urgency: urgency as 'none' | 'low' | 'medium' | 'high',
    });
    const leadTier = deriveLeadTierV3Enhanced({
      fit: fitScore,
      lead: leadScore,
      authenticity: authenticityScore,
      relevance: relevanceScore,
      buyerIntent,
      decisionMaker,
      painSeverity,
      competitorMentioned,
      switchingIntent,
    });

    // Backward compat: engage_score = avg(authenticity, relevance)
    const engageScore = Math.round((authenticityScore + relevanceScore) / 2);

    // Compute matched keywords and keyword-based tier
    const text = `${post.title} ${post.selftext}`.toLowerCase();
    const postMatchedKeywords = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    const kwTier = resolveKeywordTier(postMatchedKeywords, normalizedTiers);
    // Keyword tier takes priority; fall back to AI-derived tier
    const finalTier = kwTier || leadTier;

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
      intent_type: intentType,
      intent_score: combinedScore,
      combined_score: combinedScore,
      matched_keywords: postMatchedKeywords,
      competitor_mentioned: competitorMentioned,
      signal_types: signalTypes,
      pain_severity: painSeverity,
      decision_maker: decisionMaker,
      is_comment: !!(post as unknown as { _is_comment?: boolean })._is_comment,
      parent_post_id: ((post as unknown as { _parent_post_id?: string | null })._parent_post_id) || null,
      discord_alert_status: 'pending',
      status: 'new',
      fetched_at: new Date().toISOString(),
      // V2 fields (backward compat)
      fit_score: fitScore,
      lead_score: leadScore,
      engage_score: engageScore,
      lead_tier: finalTier,
      is_unseen: true,
      // V3 fields
      authenticity_score: authenticityScore,
      relevance_score: relevanceScore,
      buyer_intent: buyerIntent,
      discovery_source: postSource,
      pipeline_version: 3,
      // V3 enhanced fields
      urgency,
      match_reason: matchReason,
    };
  });

  // ---- Upsert with multi-level fallback ----
  if (signals.length > 0) {
    const { error: upsertError } = await supabase
      .from('outreach_signals')
      .upsert(signals, { onConflict: 'project_id,reddit_id' });

    if (upsertError) {
      // Strip V3 + enhanced columns and retry with V2
      const withoutV3 = signals.map(({ authenticity_score, relevance_score, buyer_intent, discovery_source, pipeline_version, urgency, match_reason, ...rest }) => rest);
      const { error: retryV2Error } = await supabase
        .from('outreach_signals')
        .upsert(withoutV3, { onConflict: 'project_id,reddit_id' });

      if (retryV2Error) {
        // Strip V2 columns too
        const withoutV2 = withoutV3.map(({ fit_score, lead_score, engage_score, lead_tier, is_unseen, ...rest }) => rest);
        const { error: retryBaseError } = await supabase
          .from('outreach_signals')
          .upsert(withoutV2, { onConflict: 'project_id,reddit_id' });

        if (retryBaseError) {
          // Final fallback with base fields only
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
  }

  // ---- Upsert competitor mentions ----
  try {
    const competitorMentionRows: {
      project_id: string;
      signal_id: string | undefined;
      competitor_name: string;
      mention_context: string;
      sentiment: string;
      switching_intent: boolean;
    }[] = [];

    for (const post of filteredPosts) {
      const v3 = v3Classifications.get(post.id);
      if (v3?.competitor_mentions && v3.competitor_mentions.length > 0) {
        for (const cm of v3.competitor_mentions) {
          competitorMentionRows.push({
            project_id: projectId,
            signal_id: undefined,
            competitor_name: cm.name,
            mention_context: cm.context,
            sentiment: cm.sentiment,
            switching_intent: cm.switching_intent,
          });
        }
      }
    }

    if (competitorMentionRows.length > 0) {
      const redditIds = filteredPosts
        .filter((p) => v3Classifications.has(p.id) && (v3Classifications.get(p.id)?.competitor_mentions?.length ?? 0) > 0)
        .map((p) => p.id);

      const { data: signalRows } = await supabase
        .from('outreach_signals')
        .select('id, reddit_id')
        .eq('project_id', projectId)
        .in('reddit_id', redditIds);

      const signalIdMap = new Map(
        (signalRows || []).map((s: { id: string; reddit_id: string }) => [s.reddit_id, s.id])
      );

      let mentionIdx = 0;
      for (const post of filteredPosts) {
        const v3 = v3Classifications.get(post.id);
        const mentionCount = v3?.competitor_mentions?.length ?? 0;
        for (let i = 0; i < mentionCount && mentionIdx < competitorMentionRows.length; i++) {
          competitorMentionRows[mentionIdx].signal_id = signalIdMap.get(post.id);
          mentionIdx++;
        }
      }

      const validMentions = competitorMentionRows.filter((m) => m.signal_id);
      if (validMentions.length > 0) {
        await supabase.from('competitor_mentions').insert(validMentions);
      }
    }
  } catch {
    // competitor_mentions table may not exist yet
  }

  return {
    count: signals.length,
    totalFetched: allPosts.size,
    alreadyExisting: existingIds.size,
    newPosts: newPosts.length,
    filtered: filteredPosts.length,
    classified: v3Classifications.size,
    fetchErrors: fetchErrors.length > 0 ? fetchErrors : undefined,
  };
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
