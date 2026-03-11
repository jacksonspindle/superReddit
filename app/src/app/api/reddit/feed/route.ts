import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Feed endpoint — returns tracked subreddit names for a project.
 * Reddit post fetching is done client-side (Reddit blocks datacenter IPs).
 *
 * Query params:
 *   projectId — required
 *
 * Response: { trackedSubreddits: string[] }
 */

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const projectId = sp.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: subs } = await supabase
    .from('subreddits')
    .select('name')
    .eq('project_id', projectId);

  const trackedSubreddits = (subs ?? []).map((s) => s.name);

  return NextResponse.json({ trackedSubreddits });
}
