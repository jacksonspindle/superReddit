import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/** Strip u/ or /u/ prefix, trim, lowercase */
function normalizeUsername(raw: string): string {
  return raw.replace(/^\/?u\//, '').trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Look up project's configured Reddit username
    const { data: config } = await supabase
      .from('outreach_configs')
      .select('reddit_username')
      .eq('project_id', projectId)
      .maybeSingle();

    const configUsername = config?.reddit_username
      ? normalizeUsername(config.reddit_username)
      : null;

    // If no config username set, return empty — pipeline should prompt to configure
    if (!configUsername) {
      return NextResponse.json({ dms: [], no_config: true });
    }

    const pipelineStage = request.nextUrl.searchParams.get('pipeline_stage');
    const followUpDue = request.nextUrl.searchParams.get('follow_up_due');

    // Show DMs that match the config account OR haven't been stamped yet (pre-migration rows).
    // Once bridge-sync re-stamps them, NULL rows transition to the correct sender_account.
    let query = supabase
      .from('outreach_dms')
      .select('*, signal:outreach_signals(title, subreddit, permalink, score, num_comments)')
      .eq('project_id', projectId)
      .or(`sender_account.eq.${configUsername},sender_account.is.null`)
      .order('created_at', { ascending: false });

    if (pipelineStage && pipelineStage !== 'all') {
      query = query.eq('pipeline_stage', pipelineStage);
    }

    if (followUpDue === 'true') {
      query = query.lte('follow_up_due', new Date().toISOString()).not('follow_up_due', 'is', null);
    }

    let { data, error } = await query.limit(500);

    // Graceful fallback: if sender_account column doesn't exist yet, query without it
    if (error && error.message?.includes('sender_account')) {
      let fallbackQuery = supabase
        .from('outreach_dms')
        .select('*, signal:outreach_signals(title, subreddit, permalink, score, num_comments)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (pipelineStage && pipelineStage !== 'all') {
        fallbackQuery = fallbackQuery.eq('pipeline_stage', pipelineStage);
      }

      if (followUpDue === 'true') {
        fallbackQuery = fallbackQuery.lte('follow_up_due', new Date().toISOString()).not('follow_up_due', 'is', null);
      }

      const fallback = await fallbackQuery.limit(500);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dms: data ?? [] });
  } catch (error) {
    console.error('DMs fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch DMs' }, { status: 500 });
  }
}
