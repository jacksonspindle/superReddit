import { NextRequest, NextResponse } from 'next/server';
import { WRITING_STYLES } from '@/lib/viral-library/styles';
import { searchSubredditPosts } from '@/lib/reddit/fetcher';
import type { RedditPost } from '@/types';

export async function GET(request: NextRequest) {
  const style = request.nextUrl.searchParams.get('style');
  if (!style) {
    return NextResponse.json({ error: 'style parameter is required' }, { status: 400 });
  }

  const stylesToFetch =
    style === 'all'
      ? WRITING_STYLES
      : WRITING_STYLES.filter((s) => s.id === style);

  if (stylesToFetch.length === 0) {
    return NextResponse.json({ error: 'Unknown style' }, { status: 400 });
  }

  const results = await Promise.allSettled(
    stylesToFetch.map(async (s) => {
      const query = s.searchQueries.join(' OR ');
      const res = await searchSubredditPosts(s.subreddit, query, 15);
      return { styleId: s.id, posts: res.posts ?? [] };
    })
  );

  const postsByStyle: Record<string, RedditPost[]> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      postsByStyle[result.value.styleId] = result.value.posts;
    }
  }

  return NextResponse.json({ postsByStyle });
}
