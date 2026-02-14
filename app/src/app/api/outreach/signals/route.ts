import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectSignals } from '@/lib/outreach/detector';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get outreach config
    const { data: config } = await supabase
      .from('outreach_configs')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (!config?.setup_completed) {
      return NextResponse.json({ error: 'Outreach setup not completed' }, { status: 400 });
    }

    // Check if we need to detect new signals (if none exist or latest is older than 30 min)
    const { data: latestSignal } = await supabase
      .from('outreach_signals')
      .select('fetched_at')
      .eq('project_id', projectId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const isStale = !latestSignal ||
      Date.now() - new Date(latestSignal.fetched_at).getTime() > staleThreshold;

    if (isStale) {
      // Get project info for product context
      const { data: project } = await supabase
        .from('projects')
        .select('product_name, product_description')
        .eq('id', projectId)
        .single();

      // Get project subreddits
      const { data: subreddits } = await supabase
        .from('subreddits')
        .select('name')
        .eq('project_id', projectId);

      const subNames = subreddits?.map((s) => s.name) || [];

      if (project && subNames.length > 0) {
        await detectSignals(supabase, {
          projectId,
          keywords: config.keywords || [],
          competitors: config.competitors || [],
          subreddits: subNames,
          subredditLimit: config.subreddit_limit || 20,
          productName: project.product_name,
          productDescription: project.product_description,
        });
      }
    }

    // Fetch all signals sorted by combined score
    const status = request.nextUrl.searchParams.get('status');
    const intentType = request.nextUrl.searchParams.get('intent_type');
    const subredditFilter = request.nextUrl.searchParams.get('subreddit');

    let query = supabase
      .from('outreach_signals')
      .select('*')
      .eq('project_id', projectId)
      .order('combined_score', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (intentType) {
      query = query.eq('intent_type', intentType);
    }
    if (subredditFilter) {
      query = query.eq('subreddit', subredditFilter);
    }

    const { data: signals, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signals: signals || [] });
  } catch (error) {
    console.error('Signals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
