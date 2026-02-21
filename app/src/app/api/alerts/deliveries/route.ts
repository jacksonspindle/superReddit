import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const channel = request.nextUrl.searchParams.get('channel');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 50;

    const supabase = await createClient();

    // Validate session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 403 });
    }

    // Query alert deliveries with joined signal data
    let query = supabase
      .from('alert_deliveries')
      .select(`
        *,
        signal:outreach_signals(title, subreddit, permalink, matched_keywords, fetched_at)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(parsedLimit);

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Deliveries query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deliveries: data });
  } catch (error) {
    console.error('Alert deliveries GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch alert deliveries' }, { status: 500 });
  }
}
