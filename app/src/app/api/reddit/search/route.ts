import { NextRequest, NextResponse } from 'next/server';
import { searchRedditGlobal } from '@/lib/reddit/fetcher';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q');
  const sort = searchParams.get('sort') || 'relevance';
  const t = searchParams.get('t') || 'week';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!q) {
    return NextResponse.json({ error: 'q parameter is required' }, { status: 400 });
  }

  try {
    const result = await searchRedditGlobal(q, sort, t, Math.min(limit, 50));

    return NextResponse.json({
      posts: result.posts,
      error: result.error,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message, posts: [] },
      { status: 500 }
    );
  }
}
