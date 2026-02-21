import cron from 'node-cron';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';
import { findMatches } from './matcher.js';
import { dispatchPendingAlerts } from './dispatcher.js';

const POLL_INTERVAL = process.env.POLL_INTERVAL_MINUTES || '5';
const ENRICHMENT_API_URL = process.env.ENRICHMENT_API_URL || '';
const ENRICHMENT_API_KEY = process.env.ENRICHMENT_API_KEY || '';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  subreddit: string;
  url: string;
  permalink: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

/**
 * Start the Reddit polling cron job.
 */
export function startPoller() {
  const cronExpression = `*/${POLL_INTERVAL} * * * *`;
  console.log(`Starting Reddit poller (every ${POLL_INTERVAL} minutes)`);

  // Run immediately on start
  pollAllProjects();

  // Then schedule
  cron.schedule(cronExpression, () => {
    pollAllProjects();
  });
}

/**
 * Poll all active projects for new Reddit content.
 * Reads from outreach_configs (unified table).
 */
async function pollAllProjects() {
  try {
    const { data: configs, error } = await supabase
      .from('outreach_configs')
      .select('*')
      .eq('discord_connected', true)
      .eq('polling_enabled', true);

    if (error || !configs?.length) return;

    for (const config of configs) {
      try {
        await pollProject(config);
      } catch (err) {
        console.error(`Error polling project ${config.project_id}:`, err);
      }
    }
  } catch (err) {
    console.error('Poll cycle error:', err);
  }
}

/**
 * Poll a single project's monitored subreddits.
 */
async function pollProject(config: {
  project_id: string;
  discord_webhook_url: string;
}) {
  // Get active subreddits from outreach_monitored_subs
  const { data: subreddits } = await supabase
    .from('outreach_monitored_subs')
    .select('*')
    .eq('project_id', config.project_id)
    .eq('is_active', true);

  if (!subreddits?.length) return;

  // Get active keywords from outreach_keywords
  const { data: keywords } = await supabase
    .from('outreach_keywords')
    .select('*')
    .eq('project_id', config.project_id)
    .eq('is_active', true);

  if (!keywords?.length) return;

  // Filter out silenced keywords
  const now = new Date();
  const activeKeywords = keywords.filter(
    (kw: { silenced_until: string | null }) =>
      !kw.silenced_until || new Date(kw.silenced_until) < now
  );

  if (!activeKeywords.length) return;

  // Poll each subreddit
  for (const sub of subreddits) {
    try {
      const posts = await fetchSubredditPosts(sub.name);

      for (const post of posts) {
        // Deduplicate via content hash
        const contentHash = hashContent(post.permalink);
        const isDuplicate = await checkDuplicate(contentHash, config.project_id);
        if (isDuplicate) continue;

        // Cache this content
        await cacheContent(contentHash, post.permalink, config.project_id);

        // Match against keywords
        const text = `${post.title} ${post.selftext}`;
        const matches = findMatches(text, activeKeywords);

        if (matches.length === 0) continue;

        // Upsert into outreach_signals (unified table)
        const matchedPhrases = matches.map((m) => m.matchedPhrase);
        await supabase.from('outreach_signals').upsert(
          {
            project_id: config.project_id,
            reddit_id: post.id,
            subreddit: post.subreddit,
            title: post.title,
            body: post.selftext?.slice(0, 2000) || null,
            author: post.author,
            score: post.score,
            num_comments: post.num_comments,
            permalink: post.permalink,
            created_utc: post.created_utc,
            matched_keywords: matchedPhrases,
            intent_type: 'unknown',
            intent_score: 0,
            combined_score: 0,
            competitor_mentioned: false,
            signal_types: [],
            discord_alert_status: 'pending',
            status: 'new',
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,reddit_id' }
        );

        // Trigger AI enrichment if endpoint configured
        if (ENRICHMENT_API_URL) {
          triggerEnrichment(config.project_id, post.id).catch((err) =>
            console.error(`Enrichment trigger failed for ${post.id}:`, err)
          );
        }
      }

      // Update last polled time
      await supabase
        .from('outreach_monitored_subs')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', sub.id);
    } catch (err) {
      console.error(`Error polling r/${sub.name}:`, err);
    }
  }

  // Dispatch any pending Discord alerts
  if (config.discord_webhook_url) {
    await dispatchPendingAlerts(config.project_id, config.discord_webhook_url);
  }
}

/**
 * Trigger AI enrichment for a post via the Next.js API.
 */
async function triggerEnrichment(projectId: string, redditId: string): Promise<void> {
  if (!ENRICHMENT_API_URL || !ENRICHMENT_API_KEY) return;

  await fetch(`${ENRICHMENT_API_URL}/api/outreach/signals/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ENRICHMENT_API_KEY,
    },
    body: JSON.stringify({ project_id: projectId, reddit_id: redditId }),
  });
}

/**
 * Fetch latest posts from a subreddit using Reddit's public JSON API.
 */
async function fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=25`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SuperReddit/1.0',
    },
  });

  if (!response.ok) {
    console.error(`Reddit API error for r/${subreddit}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return (data?.data?.children || []).map((child: { data: RedditPost }) => child.data);
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function checkDuplicate(hash: string, projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from('outreach_content_cache')
    .select('id')
    .eq('content_hash', hash)
    .eq('project_id', projectId)
    .single();

  return !!data;
}

async function cacheContent(hash: string, url: string, projectId: string): Promise<void> {
  await supabase.from('outreach_content_cache').insert({
    content_hash: hash,
    reddit_url: url,
    project_id: projectId,
  });
}
