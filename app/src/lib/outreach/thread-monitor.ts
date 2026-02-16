import type { SupabaseClient } from '@supabase/supabase-js';
import type { PermissionType } from '@/types';
import { fetchThreadComments, fetchUserPosts } from '@/lib/reddit/fetcher';
import { detectPermission } from '@/lib/outreach/permission-detector';

export interface DetectedCommenter {
  reddit_username: string;
  comment_text: string;
  comment_permalink: string;
  source_thread_permalink: string;
  source_signal_id: string | null;
  permission_type: PermissionType;
  permission_score: number;
  matched_pattern: string | null;
}

export async function monitorTrackedThreads(
  supabase: SupabaseClient,
  { projectId, redditUsername }: { projectId: string; redditUsername: string }
): Promise<DetectedCommenter[]> {
  // 1. Get tracked threads (replies that have been copied/posted/tracking)
  const { data: replies } = await supabase
    .from('outreach_replies')
    .select('thread_permalink, signal_id, reddit_comment_id')
    .eq('project_id', projectId)
    .in('status', ['copied', 'posted', 'tracking'])
    .order('created_at', { ascending: false })
    .limit(10);

  // Also fetch the user's recent Reddit posts
  const userPosts = await fetchUserPosts(redditUsername, 10);
  const replyPermalinks = new Set((replies || []).map(r => r.thread_permalink));

  // Merge user posts into the thread list (avoid duplicates)
  const userPostThreads = userPosts
    .filter(p => !replyPermalinks.has(p.permalink))
    .map(p => ({ thread_permalink: p.permalink, signal_id: null, reddit_comment_id: null }));

  const allThreads = [...(replies || []), ...userPostThreads];

  if (allThreads.length === 0) return [];

  // 2. Get already-tracked usernames for this project to avoid duplicates
  const { data: existingDms } = await supabase
    .from('outreach_dms')
    .select('reddit_username, source_thread_permalink')
    .eq('project_id', projectId);

  const existingKeys = new Set(
    (existingDms || []).map((d) => `${d.reddit_username}::${d.source_thread_permalink}`)
  );

  const detected: DetectedCommenter[] = [];

  // 3. For each tracked thread, fetch comments and detect new leads
  for (const reply of allThreads) {
    if (!reply.thread_permalink) continue;

    const comments = await fetchThreadComments(reply.thread_permalink);
    if (comments.length === 0) continue;

    // Build a set of the user's own comment IDs for reply detection
    const userCommentIds = new Set<string>();
    if (reply.reddit_comment_id) {
      userCommentIds.add(`t1_${reply.reddit_comment_id}`);
    }
    // Also detect by username
    const lowerUsername = redditUsername.toLowerCase();

    for (const comment of comments) {
      // Skip the user's own comments
      if (comment.author.toLowerCase() === lowerUsername) {
        // Track user's comment IDs for isReplyToUser detection
        userCommentIds.add(comment.id);
        continue;
      }

      // Skip deleted/removed authors
      if (comment.author === '[deleted]' || comment.author === 'AutoModerator') continue;

      // Skip already-tracked
      const key = `${comment.author}::${reply.thread_permalink}`;
      if (existingKeys.has(key)) continue;

      // Determine if this is a direct reply to the user's comment
      const isReplyToUser = userCommentIds.has(comment.parent_id);

      // Run permission detection
      const permission = detectPermission(comment.body, isReplyToUser);

      detected.push({
        reddit_username: comment.author,
        comment_text: comment.body,
        comment_permalink: comment.permalink,
        source_thread_permalink: reply.thread_permalink,
        source_signal_id: reply.signal_id || null,
        permission_type: permission.type,
        permission_score: permission.score,
        matched_pattern: permission.matchedPattern,
      });

      // Mark as tracked to avoid duplicates within this scan
      existingKeys.add(key);
    }
  }

  return detected;
}
