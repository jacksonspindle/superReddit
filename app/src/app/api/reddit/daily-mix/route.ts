import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchSubredditPosts, searchSubredditPosts } from '@/lib/reddit/fetcher';
import { extractDiscoverKeywords } from '@/lib/reddit/keywords';
import type { RedditPost } from '@/types';

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch project + subreddits in parallel
  const [projectRes, subredditsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('product_name, product_description, target_audience')
      .eq('id', projectId)
      .single(),
    supabase.from('subreddits').select('name').eq('project_id', projectId),
  ]);

  if (projectRes.error || !projectRes.data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { product_name, product_description, target_audience } = projectRes.data;
  const trackedSubreddits = (subredditsRes.data ?? []).map((s) => s.name);

  if (trackedSubreddits.length === 0) {
    return NextResponse.json({
      feed: [],
      discover: [],
      trackedSubreddits: [],
      empty: true,
    });
  }

  // --- Feed: hot posts from tracked subs (up to 6) ---
  const feedSubs = trackedSubreddits.slice(0, 6);
  const feedResults = await Promise.all(
    feedSubs.map((sub) => fetchSubredditPosts(sub, 'hot', 'week', 5))
  );

  const feedSeen = new Set<string>();
  const feed: RedditPost[] = feedResults
    .flatMap((r) => r.posts ?? [])
    .filter((p) => {
      if (feedSeen.has(p.id)) return false;
      feedSeen.add(p.id);
      return true;
    })
    .sort((a, b) => b.score - a.score);

  // --- Discover: keyword search on r/all, excluding tracked subs ---
  const keywords = extractDiscoverKeywords(product_name, product_description, target_audience);
  const searchKeywords = keywords.slice(0, 3);

  const discoverResults = await Promise.all(
    searchKeywords.map((kw) => searchSubredditPosts('all', kw, 10))
  );

  const trackedSet = new Set(trackedSubreddits.map((s) => s.toLowerCase()));
  const discoverSeen = new Set<string>();
  const discover: RedditPost[] = discoverResults
    .flatMap((r) => r.posts ?? [])
    .filter((p) => {
      if (trackedSet.has(p.subreddit.toLowerCase())) return false;
      if (discoverSeen.has(p.id)) return false;
      discoverSeen.add(p.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return NextResponse.json({ feed, discover, trackedSubreddits });
}
