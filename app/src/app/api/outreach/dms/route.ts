import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const pipelineStage = request.nextUrl.searchParams.get('pipeline_stage');
    const followUpDue = request.nextUrl.searchParams.get('follow_up_due');

    let query = supabase
      .from('outreach_dms')
      .select('*, signal:outreach_signals(title, subreddit, permalink)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (pipelineStage && pipelineStage !== 'all') {
      query = query.eq('pipeline_stage', pipelineStage);
    }

    if (followUpDue === 'true') {
      query = query.lte('follow_up_due', new Date().toISOString()).not('follow_up_due', 'is', null);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dms: data ?? [] });
  } catch (error) {
    console.error('DMs fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch DMs' }, { status: 500 });
  }
}
