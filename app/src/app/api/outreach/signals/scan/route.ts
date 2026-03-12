import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectSignalsV3 } from '@/lib/outreach/detector';

export const maxDuration = 60;

/**
 * POST /api/outreach/signals/scan
 * Streams NDJSON progress events while running the V3 detection pipeline.
 */
export async function POST(request: NextRequest) {
  // Parse body and do validation before starting the stream
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const projectId = body.project_id as string;
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('product_name, product_description, target_audience')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: subreddits } = await supabase
    .from('subreddits')
    .select('name')
    .eq('project_id', projectId);

  const subNames = subreddits?.map((s: { name: string }) => s.name) || [];

  if (subNames.length === 0) {
    return NextResponse.json({ error: 'No subreddits configured.' }, { status: 400 });
  }

  // Get config
  let config: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase
      .from('outreach_configs')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    config = data;
  } catch {
    // Config may not exist
  }

  // Derive keywords + tier map
  let keywords: string[] = [];
  const keywordTiers: Record<string, 'hot' | 'warm' | 'cold' | null> = {};
  try {
    const { data: keywordRows } = await supabase
      .from('outreach_keywords')
      .select('phrases, tier')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (keywordRows?.length) {
      for (const k of keywordRows as { phrases: string[]; tier?: string | null }[]) {
        for (const phrase of k.phrases) {
          keywords.push(phrase);
          if (k.tier) keywordTiers[phrase.toLowerCase()] = k.tier as 'hot' | 'warm' | 'cold';
        }
      }
    }
  } catch {
    // Table may not exist
  }

  if (keywords.length === 0) {
    keywords = (config?.keywords as string[]) || [];
  }
  if (keywords.length === 0) {
    keywords = [project.product_name];
    if (project.target_audience) {
      keywords.push(project.target_audience);
    }
  }

  const competitors: string[] = (config?.competitors as string[]) || [];
  const timeFilter = body.time_filter || (config?.time_filter as string) || 'week';
  const maxResults = body.max_results || (config?.max_results as number) || 100;
  const includeComments = body.include_comments ?? (config?.include_comments as boolean) ?? true;
  const skipCache = body.skip_cache ?? false;

  console.log(`[Scan] Starting for project ${projectId}`);
  console.log(`[Scan] Subreddits: ${subNames.join(', ')}`);
  console.log(`[Scan] Keywords: ${keywords.join(', ')}`);

  // Fetch product context
  let productContext: {
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
      productContext = {
        problemsSolved: productCtx.problems_solved || [],
        solutionFeatures: productCtx.solution_features || [],
        audienceBehaviors: productCtx.audience_behaviors || [],
        competitorWeaknesses: productCtx.competitor_weaknesses || [],
      };
    }
  } catch {
    // Table may not exist
  }

  const clientRedditPosts = body.reddit_posts || undefined;
  const _debugLog: string[] = [];

  try {
    const count = await detectSignalsV3(supabase, {
      projectId,
      keywords,
      keywordTiers,
      competitors,
      subreddits: subNames,
      subredditLimit: (config?.subreddit_limit as number) || 20,
      productName: project.product_name,
      productDescription: project.product_description,
      productContext,
      timeFilter: timeFilter as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all',
      maxResults: maxResults as number,
      includeComments: includeComments as boolean,
      browseSubreddits: true,
      prefetchedPosts: clientRedditPosts as undefined,
      skipCache: skipCache as boolean,
      _debugLog,
    });

    console.log(`[Scan] Completed for project ${projectId}: ${count} signals`);
    return NextResponse.json({ completed: true, count, _debug: _debugLog });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
