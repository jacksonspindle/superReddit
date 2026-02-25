import { NextRequest, NextResponse } from 'next/server';

const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json({ subreddits: [] });
  }

  try {
    const res = await fetch(
      `https://old.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=8&raw_json=1`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }
    );

    if (!res.ok) {
      console.error(`Reddit search failed: ${res.status} ${res.statusText}`);
      return NextResponse.json({ subreddits: [] });
    }

    const json = (await res.json()) as {
      data: { children: Array<{ data: Record<string, unknown> }> };
    };

    const subreddits = json.data.children.map((c) => ({
      name: c.data.display_name as string,
      subscribers: (c.data.subscribers as number) || 0,
      description: ((c.data.public_description as string) || '').slice(0, 120),
    }));

    return NextResponse.json({ subreddits });
  } catch (err) {
    console.error('Reddit subreddit search error:', err);
    return NextResponse.json({ subreddits: [] });
  }
}
