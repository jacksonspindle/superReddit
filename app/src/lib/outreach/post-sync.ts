import { fetchAllUserPosts } from '@/lib/reddit/fetcher';
import type { SupabaseClient } from '@supabase/supabase-js';

interface SyncOptions {
  projectId: string;
  redditUsername: string;
}

interface SyncResult {
  synced: boolean;
  newPosts: number;
  totalPosts: number;
}

export async function syncUserPosts(
  supabase: SupabaseClient,
  { projectId, redditUsername }: SyncOptions
): Promise<SyncResult> {
  // Fetch known reddit_ids for this project
  const { data: existing } = await supabase
    .from('monitored_posts')
    .select('reddit_id')
    .eq('project_id', projectId);

  const knownIds = new Set((existing || []).map((r: { reddit_id: string }) => r.reddit_id));
  const isFirstSync = knownIds.size === 0;

  // Fetch posts from Reddit with incremental stop
  const posts = await fetchAllUserPosts(redditUsername, {
    maxPages: isFirstSync ? 10 : 3,
    shouldStop: isFirstSync
      ? undefined
      : (pageIds) => pageIds.some((id) => knownIds.has(id)),
  });

  // Filter to only new posts
  const newPosts = posts.filter((p) => !knownIds.has(p.id));

  if (newPosts.length > 0) {
    const rows = newPosts.map((p) => ({
      project_id: projectId,
      reddit_id: p.id,
      title: p.title,
      selftext: p.selftext || null,
      subreddit: p.subreddit,
      author: p.author,
      score: p.score,
      num_comments: p.num_comments,
      permalink: p.permalink,
      url: p.url,
      created_utc: p.created_utc,
      is_self: p.is_self,
      thumbnail: p.thumbnail,
      preview_url: p.preview_url,
      link_flair_text: p.link_flair_text,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('monitored_posts')
      .upsert(rows, { onConflict: 'project_id,reddit_id' });

    if (error) {
      console.error('monitored_posts upsert error:', error);
    }
  }

  // Get total count
  const { count } = await supabase
    .from('monitored_posts')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  return {
    synced: true,
    newPosts: newPosts.length,
    totalPosts: count || knownIds.size + newPosts.length,
  };
}
