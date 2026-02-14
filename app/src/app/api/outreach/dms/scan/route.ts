import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { monitorTrackedThreads } from '@/lib/outreach/thread-monitor';
import { clearCommentCache } from '@/lib/reddit/fetcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, force } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Use auth client to verify the user owns this project
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service client for the actual scan (avoids RLS issues with seeded data)
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

    // Staleness check: skip if last DM was created < 15 min ago (unless forced)
    if (!force) {
      const { data: latestDm } = await supabase
        .from('outreach_dms')
        .select('created_at')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const staleThreshold = 15 * 60 * 1000;
      const isStale = !latestDm ||
        Date.now() - new Date(latestDm.created_at).getTime() > staleThreshold;

      if (!isStale) {
        return NextResponse.json({ message: 'Data is fresh, skipping scan', scanned: false });
      }
    }

    // Clear comment cache when forced so we get fresh data from Reddit
    if (force) {
      clearCommentCache();
    }

    // Get outreach config for reddit username
    const { data: config } = await supabase
      .from('outreach_configs')
      .select('reddit_username, setup_completed')
      .eq('project_id', project_id)
      .maybeSingle();

    if (!config?.setup_completed) {
      return NextResponse.json({ message: 'Outreach setup not completed', scanned: false });
    }

    if (!config?.reddit_username) {
      return NextResponse.json({ message: 'Reddit username not configured. Set it in Outreach setup.', scanned: false });
    }

    // Run thread monitoring
    const detected = await monitorTrackedThreads(supabase, {
      projectId: project_id,
      redditUsername: config.reddit_username,
    });

    if (detected.length === 0) {
      return NextResponse.json({ message: 'No new commenters detected', scanned: true, count: 0 });
    }

    // Upsert detected commenters into outreach_dms
    const rows = detected.map((d) => ({
      project_id,
      reddit_username: d.reddit_username,
      comment_text: d.comment_text,
      comment_permalink: d.comment_permalink,
      source_thread_permalink: d.source_thread_permalink,
      source_signal_id: d.source_signal_id,
      permission_type: d.permission_type,
      permission_score: d.permission_score,
      matched_pattern: d.matched_pattern,
      pipeline_stage: d.permission_type === 'explicit_dm_request' ? 'dm_ready' : 'detected',
    }));

    const { error } = await supabase
      .from('outreach_dms')
      .upsert(rows, { onConflict: 'project_id,reddit_username,source_thread_permalink' });

    if (error) {
      console.error('DM upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ scanned: true, count: detected.length });
  } catch (error) {
    console.error('DM scan error:', error);
    return NextResponse.json({ error: 'Failed to scan threads' }, { status: 500 });
  }
}
