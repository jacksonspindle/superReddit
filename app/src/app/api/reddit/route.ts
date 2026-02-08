import { NextRequest, NextResponse } from 'next/server';
import { fetchSubredditPosts, fetchSubredditInfo, searchSubredditPosts } from '@/lib/reddit/fetcher';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subreddit = searchParams.get('subreddit');
  const sort = (searchParams.get('sort') || 'hot') as 'hot' | 'top' | 'rising' | 'new';
  const timeFilter = (searchParams.get('t') || 'week') as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const query = searchParams.get('q');
  const includeInfo = searchParams.get('info') === 'true';

  if (!subreddit) {
    return NextResponse.json({ error: 'subreddit parameter is required' }, { status: 400 });
  }

  // Sanitize subreddit name
  const cleanSubreddit = subreddit.replace(/^r\//, '').replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleanSubreddit) {
    return NextResponse.json({ error: 'Invalid subreddit name' }, { status: 400 });
  }

  try {
    const [postsResult, infoResult] = await Promise.all([
      query
        ? searchSubredditPosts(cleanSubreddit, query, limit)
        : fetchSubredditPosts(cleanSubreddit, sort, timeFilter, limit),
      includeInfo ? fetchSubredditInfo(cleanSubreddit) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      posts: postsResult.posts,
      subredditInfo: infoResult,
      error: postsResult.error,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message, posts: [] },
      { status: 500 }
    );
  }
}
