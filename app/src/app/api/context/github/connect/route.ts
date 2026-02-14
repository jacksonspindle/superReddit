import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const cleaned = url.trim().replace(/\/+$/, '');
  const ghMatch = cleaned.match(/(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (ghMatch) return { owner: ghMatch[1], repo: ghMatch[2] };
  return null;
}

async function fetchGitHubData(owner: string, repo: string, accessToken?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'SuperReddit',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const [repoRes, readmeRes, commitsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=20`, { headers }),
  ]);

  if (!repoRes.ok) {
    return null;
  }

  const repoData = await repoRes.json();

  let readmeSummary: string | null = null;
  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    if (readmeData.content) {
      const content = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      // Take first 2000 chars as summary
      readmeSummary = content.length > 2000 ? content.slice(0, 2000) + '\n\n[truncated]' : content;
    }
  }

  let recentCommits: { sha: string; message: string; author: string; date: string; url: string }[] = [];
  if (commitsRes.ok) {
    const commitsData = await commitsRes.json();
    recentCommits = commitsData.map((c: { sha: string; commit: { message: string; author: { name: string; date: string } }; html_url: string }) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    }));
  }

  return {
    description: repoData.description || null,
    homepage: repoData.homepage || null,
    language: repoData.language || null,
    stars: repoData.stargazers_count || 0,
    topics: repoData.topics || [],
    readme_summary: readmeSummary,
    recent_commits: recentCommits,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, repoUrl } = await request.json();
    if (!projectId || !repoUrl) {
      return NextResponse.json({ error: 'projectId and repoUrl are required' }, { status: 400 });
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid GitHub repository URL' }, { status: 400 });
    }

    const { owner, repo } = parsed;
    const supabase = await createClient();

    // Find access token: this project → any user project → cookie
    let accessToken: string | undefined;

    const { data: existing } = await supabase
      .from('github_connections')
      .select('access_token')
      .eq('project_id', projectId)
      .maybeSingle();

    accessToken = existing?.access_token || undefined;

    if (!accessToken) {
      const { data: anyConn } = await supabase
        .from('github_connections')
        .select('access_token, projects!inner(user_id)')
        .not('access_token', 'is', null)
        .not('access_token', 'eq', '')
        .limit(1);

      accessToken = anyConn?.[0]?.access_token || undefined;
    }

    if (!accessToken) {
      accessToken = request.cookies.get('github_token')?.value || undefined;
    }

    const ghData = await fetchGitHubData(owner, repo, accessToken);

    if (!ghData) {
      return NextResponse.json(
        { error: 'Repository not found. Make sure it exists and is accessible.' },
        { status: 404 }
      );
    }

    // Upsert the connection (include access_token so it persists for this project)
    const upsertData: Record<string, unknown> = {
      project_id: projectId,
      repo_url: repoUrl,
      owner,
      repo_name: repo,
      ...ghData,
      last_synced_at: new Date().toISOString(),
    };
    if (accessToken) {
      upsertData.access_token = accessToken;
    }

    const { data, error } = await supabase
      .from('github_connections')
      .upsert(upsertData, { onConflict: 'project_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error('GitHub connect POST error:', error);
    return NextResponse.json({ error: 'Failed to connect GitHub repository' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('github_connections')
      .delete()
      .eq('project_id', projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub connect DELETE error:', error);
    return NextResponse.json({ error: 'Failed to disconnect GitHub repository' }, { status: 500 });
  }
}
