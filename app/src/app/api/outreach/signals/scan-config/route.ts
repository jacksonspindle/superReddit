import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/outreach/signals/scan-config
 * Returns the scan configuration (subreddits, keywords, time filter, etc.)
 * so the client can fetch Reddit data directly (bypassing datacenter IP blocks).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const projectId = sp.get('project_id');

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

  // Get project info
  const { data: project } = await supabase
    .from('projects')
    .select('product_name, product_description, target_audience')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get subreddits
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

  // Derive keywords
  let keywords: string[] = [];
  try {
    const { data: keywordRows } = await supabase
      .from('outreach_keywords')
      .select('phrases, tier')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (keywordRows?.length) {
      for (const k of keywordRows as { phrases: string[] }[]) {
        for (const phrase of k.phrases) {
          keywords.push(phrase);
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

  const timeFilter = (config?.time_filter as string) || 'week';
  const maxResults = (config?.max_results as number) || 100;
  const includeComments = (config?.include_comments as boolean) ?? true;

  return NextResponse.json({
    subreddits: subNames,
    keywords,
    timeFilter,
    maxResults,
    includeComments,
  });
}
