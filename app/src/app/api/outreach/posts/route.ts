import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { syncUserPosts } from '@/lib/outreach/post-sync';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('monitored_posts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_utc', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error('Monitored posts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Auth check
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get reddit_username from outreach config
    const { data: config } = await supabase
      .from('outreach_configs')
      .select('reddit_username')
      .eq('project_id', project_id)
      .maybeSingle();

    if (!config?.reddit_username) {
      return NextResponse.json({
        synced: false,
        error: 'Reddit username not configured',
      });
    }

    // Sync posts
    const result = await syncUserPosts(supabase, {
      projectId: project_id,
      redditUsername: config.reddit_username,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Post sync error:', error);
    return NextResponse.json({ error: 'Failed to sync posts' }, { status: 500 });
  }
}
