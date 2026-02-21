import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectSignalsV3 } from '@/lib/outreach/detector';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get outreach config (table or row may not exist yet)
    let config: Record<string, unknown> | null = null;
    try {
      const { data } = await supabase
        .from('outreach_configs')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      config = data;
    } catch {
      // Table may not exist yet
    }

    // Get project info — always needed
    const { data: project } = await supabase
      .from('projects')
      .select('product_name, product_description, target_audience')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get project subreddits
    const { data: subreddits } = await supabase
      .from('subreddits')
      .select('name')
      .eq('project_id', projectId);

    const subNames = subreddits?.map((s: { name: string }) => s.name) || [];

    if (subNames.length === 0) {
      return NextResponse.json({ error: 'No subreddits configured. Add subreddits to your project first.' }, { status: 400 });
    }

    // Derive keywords: check outreach_keywords table first, then config.keywords, then auto-generate
    let keywords: string[] = [];

    // 1. Try outreach_keywords table (managed by wizard/keyword manager)
    try {
      const { data: keywordRows } = await supabase
        .from('outreach_keywords')
        .select('phrases')
        .eq('project_id', projectId)
        .eq('is_active', true);

      if (keywordRows?.length) {
        keywords = keywordRows.flatMap((k: { phrases: string[] }) => k.phrases);
      }
    } catch {
      // Table may not exist yet
    }

    // 2. Fall back to config.keywords
    if (keywords.length === 0) {
      keywords = (config?.keywords as string[]) || [];
    }

    // 3. Auto-generate from product info as last resort
    if (keywords.length === 0) {
      // Use the product name as a phrase keyword instead of splitting into single words
      keywords = [project.product_name];
      // Add target audience as a keyword if available
      if (project.target_audience) {
        keywords.push(project.target_audience);
      }
    }

    const competitors: string[] = (config?.competitors as string[]) || [];

    console.log('[Signals] Subreddits:', subNames);
    console.log('[Signals] Keywords:', keywords);
    console.log('[Signals] Competitors:', competitors);

    // Check if we need to detect new signals (if none exist or latest is older than 30 min)
    let latestSignal: { fetched_at: string } | null = null;
    try {
      const { data } = await supabase
        .from('outreach_signals')
        .select('fetched_at')
        .eq('project_id', projectId)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      latestSignal = data;
    } catch {
      // Table may not exist yet — will be created by detection pipeline or migration
    }

    // Read scan preferences from query params (overrides config)
    const paramTimeFilter = request.nextUrl.searchParams.get('time_filter');
    const paramMaxResults = request.nextUrl.searchParams.get('max_results');
    const paramIncludeComments = request.nextUrl.searchParams.get('include_comments');

    const effectiveTimeFilter = paramTimeFilter || (config?.time_filter as string) || 'week';
    const effectiveMaxResults = paramMaxResults ? parseInt(paramMaxResults, 10) : (config?.max_results as number) || 100;
    const effectiveIncludeComments = paramIncludeComments !== null
      ? paramIncludeComments !== 'false'
      : (config?.include_comments as boolean) ?? true;

    const forceRefresh = request.nextUrl.searchParams.get('force') === 'true';
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const isStale = !latestSignal ||
      Date.now() - new Date(latestSignal.fetched_at).getTime() > staleThreshold;

    if (isStale || forceRefresh) {
      // Fetch product context if available (table may not exist yet)
      let productContextOption: {
        problemsSolved: string[];
        solutionFeatures: string[];
        audienceBehaviors: string[];
        competitorWeaknesses: string[];
      } | undefined;

      try {
        const { data: productCtx } = await supabase
          .from('outreach_product_context')
          .select('problems_solved, solution_features, audience_behaviors, competitor_weaknesses')
          .eq('project_id', projectId)
          .maybeSingle();

        if (productCtx) {
          productContextOption = {
            problemsSolved: productCtx.problems_solved || [],
            solutionFeatures: productCtx.solution_features || [],
            audienceBehaviors: productCtx.audience_behaviors || [],
            competitorWeaknesses: productCtx.competitor_weaknesses || [],
          };
        }
      } catch {
        // Table may not exist yet, skip product context
      }

      // Always run inline detection for immediate results.
      // Queue-based scanning is handled by the cron job (/api/cron/poll-signals).
      try {
        await detectSignalsV3(supabase, {
          projectId,
          keywords,
          competitors,
          subreddits: subNames,
          subredditLimit: (config?.subreddit_limit as number) || 20,
          productName: project.product_name,
          productDescription: project.product_description,
          productContext: productContextOption,
          timeFilter: effectiveTimeFilter as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all',
          maxResults: effectiveMaxResults,
          includeComments: effectiveIncludeComments,
          browseSubreddits: true,
        });
      } catch (detectError) {
        console.error('Signal detection error:', detectError);
        // Detection failed but we can still return existing signals
      }
    }

    // Fetch signals with filters
    const status = request.nextUrl.searchParams.get('status');
    const intentType = request.nextUrl.searchParams.get('intent_type');
    const subredditFilter = request.nextUrl.searchParams.get('subreddit');
    const leadTier = request.nextUrl.searchParams.get('lead_tier');
    const isComment = request.nextUrl.searchParams.get('is_comment');
    const timeRange = request.nextUrl.searchParams.get('time_range');
    const isUnseen = request.nextUrl.searchParams.get('is_unseen');
    const isFavorited = request.nextUrl.searchParams.get('is_favorited');
    const signalType = request.nextUrl.searchParams.get('signal_type');
    const buyerIntent = request.nextUrl.searchParams.get('buyer_intent');
    const discoverySource = request.nextUrl.searchParams.get('discovery_source');

    try {
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
      if (leadTier) {
        query = query.eq('lead_tier', leadTier);
      }
      if (isComment === 'true') {
        query = query.eq('is_comment', true);
      } else if (isComment === 'false') {
        query = query.eq('is_comment', false);
      }
      if (isUnseen === 'true') {
        query = query.eq('is_unseen', true);
      }
      if (isFavorited === 'true') {
        query = query.eq('is_favorited', true);
      }
      if (signalType) {
        query = query.contains('signal_types', [signalType]);
      }
      if (buyerIntent) {
        query = query.eq('buyer_intent', buyerIntent);
      }
      if (discoverySource) {
        query = query.eq('discovery_source', discoverySource);
      }
      if (timeRange) {
        const now = Math.floor(Date.now() / 1000);
        const ranges: Record<string, number> = {
          '24h': 24 * 3600,
          '7d': 7 * 24 * 3600,
          '30d': 30 * 24 * 3600,
        };
        if (ranges[timeRange]) {
          query = query.gte('created_utc', now - ranges[timeRange]);
        }
      }

      const { data: signals, error } = await query.limit(100);

      if (error) {
        // Table may not exist yet — return empty signals
        return NextResponse.json({ signals: [] });
      }

      return NextResponse.json({ signals: signals || [] });
    } catch {
      // outreach_signals table may not exist — return empty
      return NextResponse.json({ signals: [] });
    }
  } catch (error) {
    console.error('Signals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
