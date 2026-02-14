import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for token in github_connections (existing project connection)
    const { data: connections } = await supabase
      .from('github_connections')
      .select('access_token, project_id, projects!inner(user_id)')
      .not('access_token', 'is', null)
      .not('access_token', 'eq', '')
      .limit(1);

    let token = connections?.[0]?.access_token;

    // Fallback: check for token in cookie (set during onboarding OAuth)
    if (!token) {
      token = request.cookies.get('github_token')?.value || null;
    }

    if (!token) {
      return NextResponse.json({ connected: false, repos: [] });
    }

    // Fetch user's repos from GitHub
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'SuperReddit',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ connected: false, repos: [] });
    }

    const rawRepos = await res.json();
    const repos = rawRepos.map((r: {
      full_name: string;
      name: string;
      owner: { login: string };
      html_url: string;
      description: string | null;
      language: string | null;
      stargazers_count: number;
      private: boolean;
    }) => ({
      full_name: r.full_name,
      name: r.name,
      owner: r.owner.login,
      url: r.html_url,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      isPrivate: r.private,
    }));

    return NextResponse.json({ connected: true, accessToken: token, repos });
  } catch (error) {
    console.error('GitHub user-repos error:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}
