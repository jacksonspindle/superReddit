import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Check this project's github_connections for a token
    const { data: connection } = await supabase
      .from('github_connections')
      .select('access_token')
      .eq('project_id', projectId)
      .maybeSingle();

    let token = connection?.access_token;

    // 2. Fallback: check any github_connections row belonging to this user
    if (!token) {
      const { data: anyConnection } = await supabase
        .from('github_connections')
        .select('access_token, projects!inner(user_id)')
        .not('access_token', 'is', null)
        .not('access_token', 'eq', '')
        .limit(1);

      token = anyConnection?.[0]?.access_token;
    }

    // 3. Fallback: check the github_token cookie (set during onboarding OAuth)
    if (!token) {
      token = request.cookies.get('github_token')?.value || null;
    }

    if (!token) {
      return NextResponse.json({ error: 'No GitHub token found' }, { status: 401 });
    }

    // Fetch user's repos (up to 100, sorted by most recently pushed)
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'SuperReddit',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch repositories from GitHub' }, { status: 502 });
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
      updated_at: string;
    }) => ({
      full_name: r.full_name,
      name: r.name,
      owner: r.owner.login,
      url: r.html_url,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      isPrivate: r.private,
      updated_at: r.updated_at,
    }));

    return NextResponse.json({ repos, accessToken: token });
  } catch (error) {
    console.error('GitHub repos GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}
