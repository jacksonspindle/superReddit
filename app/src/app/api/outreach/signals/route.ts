import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectSignals } from '@/lib/outreach/detector';
import { enqueueProject, getScanStatus } from '@/lib/outreach/poll-queue';

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

    // Derive keywords: use config keywords if available, otherwise auto-generate from product info
    let keywords: string[] = (config?.keywords as string[]) || [];
    if (keywords.length === 0) {
      const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'about', 'up', 'out', 'if', 'then', 'also', 'like', 'well', 'back', 'there', 'here']);
      const text = `${project.product_name} ${project.product_description} ${project.target_audience || ''}`;
      const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
      keywords = [...new Set(words)].slice(0, 10);
    }

    const competitors: string[] = (config?.competitors as string[]) || [];

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

      // Try queue-based scanning first (non-blocking), fall back to inline
      let queued = false;
      if (forceRefresh) {
        try {
          await enqueueProject(supabase, projectId, 'high');
          const scanStatus = await getScanStatus(supabase, projectId);
          if (scanStatus.status === 'queued' || scanStatus.status === 'processing') {
            queued = true;
          }
        } catch {
          // Queue table may not exist — fall back to inline detection
        }
      }

      if (!queued) {
        // Inline detection as fallback (or for stale non-force requests)
        try {
          await detectSignals(supabase, {
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
          });
        } catch (detectError) {
          console.error('Signal detection error:', detectError);
          // Detection failed but we can still return existing signals
        }
      }

      // If queued, return queue status so frontend can poll
      if (queued) {
        const scanStatus = await getScanStatus(supabase, projectId);

        // Still return existing signals along with queue status
        try {
          const { data: existingSignals } = await supabase
            .from('outreach_signals')
            .select('*')
            .eq('project_id', projectId)
            .order('combined_score', { ascending: false })
            .limit(100);

          return NextResponse.json({
            signals: existingSignals || [],
            scanStatus: scanStatus,
          });
        } catch {
          return NextResponse.json({
            signals: [],
            scanStatus: scanStatus,
          });
        }
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
