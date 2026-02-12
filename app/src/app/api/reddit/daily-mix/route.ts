import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchSubredditPosts } from '@/lib/reddit/fetcher';
import { extractDiscoverKeywords } from '@/lib/reddit/keywords';
import type { RedditPost } from '@/types';

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';

// Search Reddit for subreddits matching a query
async function findRelatedSubreddits(query: string): Promise<{ name: string; subscribers: number }[]> {
  try {
    const url = `${REDDIT_BASE}/subreddits/search.json?q=${encodeURIComponent(query)}&limit=10&raw_json=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json() as { data: { children: Array<{ data: Record<string, unknown> }> } };
    return json.data.children.map((c) => ({
      name: c.data.display_name as string,
      subscribers: (c.data.subscribers as number) || 0,
    }));
  } catch {
    return [];
  }
}

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

  // --- Discover: find related subreddits, then fetch hot posts from them ---
  const keywords = extractDiscoverKeywords(
    product_name, product_description, target_audience, trackedSubreddits
  );
  const searchKeywords = keywords.slice(0, 4);

  // Step 1: Search for subreddits related to the project context
  const subSearchResults = await Promise.all(
    searchKeywords.map((kw) => findRelatedSubreddits(kw))
  );

  // Step 2: Filter out tracked subs, dedupe, prefer mid-size niche subs over mega-subs
  const trackedSet = new Set(trackedSubreddits.map((s) => s.toLowerCase()));
  const seenSubs = new Set<string>();
  const relatedSubs = subSearchResults
    .flat()
    .filter((s) => {
      const key = s.name.toLowerCase();
      if (trackedSet.has(key)) return false;
      if (seenSubs.has(key)) return false;
      seenSubs.add(key);
      return s.subscribers >= 1000;
    })
    // Score: prefer mid-size subs (5k-500k) — niche enough to be relevant,
    // large enough to have active posts. Mega-subs (1M+) get penalized.
    .sort((a, b) => {
      const score = (subs: number) => {
        if (subs >= 1_000_000) return subs * 0.1; // penalize mega-subs
        if (subs >= 5_000) return subs * 2;        // boost mid-size
        return subs;                                // small subs neutral
      };
      return score(b.subscribers) - score(a.subscribers);
    })
    .slice(0, 4);

  // Step 3: Fetch hot posts from the discovered subreddits
  const discoverResults = await Promise.all(
    relatedSubs.map((sub) => fetchSubredditPosts(sub.name, 'hot', 'week', 5))
  );

  const discoverSeen = new Set<string>();
  const discover: RedditPost[] = discoverResults
    .flatMap((r) => r.posts ?? [])
    .filter((p) => {
      if (discoverSeen.has(p.id)) return false;
      discoverSeen.add(p.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return NextResponse.json({ feed, discover, trackedSubreddits });
}
