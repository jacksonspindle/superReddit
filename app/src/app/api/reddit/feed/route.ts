import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchSubredditPosts } from '@/lib/reddit/fetcher';
import type { RedditPost } from '@/types';

/**
 * Paginated feed endpoint for the Create page Feed tab.
 *
 * Query params:
 *   projectId  — required
 *   sort       — hot | top | rising | new (default: top)
 *   t          — day | week | month (default: day) — only used when sort=top
 *   page       — 0-indexed page number (default: 0)
 *   sub        — optional subreddit filter (only fetch from this sub)
 *
 * Each page fetches 25 posts per subreddit, merges + dedupes + sorts by score,
 * then returns the merged batch. The client tracks `page` and increments it
 * to load more.
 *
 * Response: { posts: RedditPost[], hasMore: boolean, trackedSubreddits: string[] }
 */

const POSTS_PER_SUB = 25;

// We keep a server-side map of after tokens keyed by (projectId, sub, sort, t, page)
// so the client only needs to send `page` and we can look up the right cursor.
// This lives in-memory and resets on deploy — that's fine for pagination.
const afterTokens = new Map<string, string>();

function tokenKey(projectId: string, sub: string, sort: string, t: string, page: number) {
  return `${projectId}:${sub}:${sort}:${t}:${page}`;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const projectId = sp.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const sort = (sp.get('sort') || 'top') as 'hot' | 'top' | 'rising' | 'new';
  const t = (sp.get('t') || 'day') as 'day' | 'week' | 'month';
  const page = Math.max(0, parseInt(sp.get('page') || '0', 10));
  const subFilter = sp.get('sub') || null;

  const supabase = await createClient();

  const { data: subs } = await supabase
    .from('subreddits')
    .select('name')
    .eq('project_id', projectId);

  const trackedSubreddits = (subs ?? []).map((s) => s.name);

  if (trackedSubreddits.length === 0) {
    return NextResponse.json({ posts: [], hasMore: false, trackedSubreddits: [] });
  }

  const targetSubs = subFilter
    ? trackedSubreddits.filter((s) => s.toLowerCase() === subFilter.toLowerCase())
    : trackedSubreddits;

  if (targetSubs.length === 0) {
    return NextResponse.json({ posts: [], hasMore: false, trackedSubreddits });
  }

  // Fetch from each subreddit in parallel, using `after` tokens for pagination
  const results = await Promise.all(
    targetSubs.map(async (sub) => {
      const afterKey = tokenKey(projectId, sub, sort, t, page);
      const after = page > 0 ? afterTokens.get(afterKey) : undefined;

      // If page > 0 but we don't have a token, this sub has no more pages
      if (page > 0 && !after) {
        return { posts: [] as RedditPost[], hasMore: false };
      }

      const result = await fetchSubredditPosts(sub, sort, t, POSTS_PER_SUB, after);

      // Store the after token for the next page
      if (result.after) {
        const nextKey = tokenKey(projectId, sub, sort, t, page + 1);
        afterTokens.set(nextKey, result.after);
      }

      return { posts: result.posts, hasMore: !!result.after };
    })
  );

  // Merge, dedupe, sort by score
  const seen = new Set<string>();
  const posts: RedditPost[] = results
    .flatMap((r) => r.posts)
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .sort((a, b) => b.score - a.score);

  // hasMore if ANY subreddit still has more pages
  const hasMore = results.some((r) => r.hasMore);

  return NextResponse.json({ posts, hasMore, trackedSubreddits });
}
