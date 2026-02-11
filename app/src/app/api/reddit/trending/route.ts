import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchSubredditPosts, fetchSubredditPosts } from '@/lib/reddit/fetcher';
import type { RedditPost } from '@/types';

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch project (for product_name) and its subreddits
  const [projectRes, subredditsRes] = await Promise.all([
    supabase.from('projects').select('product_name').eq('id', projectId).single(),
    supabase.from('subreddits').select('name').eq('project_id', projectId).limit(6),
  ]);

  if (projectRes.error || !projectRes.data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const subreddits = subredditsRes.data ?? [];
  if (subreddits.length === 0) {
    return NextResponse.json({ posts: [], empty: true });
  }

  const productName = projectRes.data.product_name;
  const postsBySub: Map<string, RedditPost[]> = new Map();

  // For each subreddit: search by product name, fallback to top posts
  await Promise.all(
    subreddits.map(async (sub) => {
      const posts: RedditPost[] = [];
      const searchResult = await searchSubredditPosts(sub.name, productName, 10);
      const searchPosts = searchResult.posts ?? [];
      posts.push(...searchPosts);

      if (searchPosts.length < 3) {
        const topResult = await fetchSubredditPosts(sub.name, 'top', 'month', 10);
        posts.push(...(topResult.posts ?? []));
      }

      // Dedupe within this subreddit and sort by score
      const seen = new Set<string>();
      const unique = posts.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      unique.sort((a, b) => b.score - a.score);
      postsBySub.set(sub.name, unique);
    })
  );

  // Guarantee minimum representation per subreddit, then fill by score
  const TOTAL = 12;
  const minPerSub = Math.min(3, Math.floor(TOTAL / postsBySub.size));
  const result: RedditPost[] = [];
  const usedIds = new Set<string>();

  // Phase 1: take top N from each subreddit
  for (const posts of postsBySub.values()) {
    for (const post of posts.slice(0, minPerSub)) {
      if (!usedIds.has(post.id)) {
        result.push(post);
        usedIds.add(post.id);
      }
    }
  }

  // Phase 2: fill remaining slots by score across all subreddits
  const remaining = Array.from(postsBySub.values())
    .flat()
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => b.score - a.score);

  for (const post of remaining) {
    if (result.length >= TOTAL) break;
    result.push(post);
  }

  // Final sort by score for display
  result.sort((a, b) => b.score - a.score);

  return NextResponse.json({ posts: result });
}
