import cron from 'node-cron';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';
import { findMatches } from './matcher.js';
import { dispatchPendingAlerts } from './dispatcher.js';

const POLL_INTERVAL = process.env.POLL_INTERVAL_MINUTES || '5';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  subreddit: string;
  url: string;
  permalink: string;
  author: string;
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
 */
async function pollAllProjects() {
  try {
    // Get all active configs with their project info
    const { data: configs, error } = await supabase
      .from('alert_configs')
      .select('*')
      .eq('is_active', true);

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
  webhook_url: string;
}) {
  // Get active subreddits
  const { data: subreddits } = await supabase
    .from('alert_subreddits')
    .select('*')
    .eq('project_id', config.project_id)
    .eq('is_active', true);

  if (!subreddits?.length) return;

  // Get active keywords
  const { data: keywords } = await supabase
    .from('alert_keywords')
    .select('*')
    .eq('project_id', config.project_id)
    .eq('is_active', true);

  if (!keywords?.length) return;

  // Poll each subreddit
  for (const sub of subreddits) {
    try {
      const posts = await fetchSubredditPosts(sub.name);

      for (const post of posts) {
        // Deduplicate via content hash
        const contentHash = hashContent(post.permalink);
        const isDuplicate = await checkDuplicate(contentHash);
        if (isDuplicate) continue;

        // Cache this content
        await cacheContent(contentHash, post.permalink);

        // Match against keywords
        const text = `${post.title} ${post.selftext}`;
        const matches = findMatches(text, keywords);

        // Create alert_matches rows
        for (const match of matches) {
          await supabase.from('alert_matches').insert({
            project_id: config.project_id,
            keyword_id: match.keywordId,
            subreddit: post.subreddit,
            title: post.title,
            snippet: post.selftext?.slice(0, 500) || null,
            matched_phrase: match.matchedPhrase,
            reddit_url: `https://reddit.com${post.permalink}`,
            reddit_author: post.author,
          });
        }
      }

      // Update last polled time
      await supabase
        .from('alert_subreddits')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', sub.id);
    } catch (err) {
      console.error(`Error polling r/${sub.name}:`, err);
    }
  }

  // Dispatch any pending alerts
  await dispatchPendingAlerts(config.project_id, config.webhook_url);
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

async function checkDuplicate(hash: string): Promise<boolean> {
  const { data } = await supabase
    .from('alert_content_cache')
    .select('id')
    .eq('content_hash', hash)
    .single();

  return !!data;
}

async function cacheContent(hash: string, url: string): Promise<void> {
  await supabase.from('alert_content_cache').insert({
    content_hash: hash,
    reddit_url: url,
  });
}
