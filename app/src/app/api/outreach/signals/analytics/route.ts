import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Try fetching with V2 columns, fall back to base columns if they don't exist yet
    let rows: { lead_tier?: string | null; combined_score: number; is_unseen?: boolean; subreddit: string }[] = [];

    const { data: signals, error } = await supabase
      .from('outreach_signals')
      .select('lead_tier, combined_score, is_unseen, subreddit')
      .eq('project_id', projectId);

    if (error) {
      // V2 columns may not exist yet, try with base columns only
      const { data: fallbackSignals, error: fallbackError } = await supabase
        .from('outreach_signals')
        .select('combined_score, subreddit')
        .eq('project_id', projectId);

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
      rows = (fallbackSignals || []).map((s) => ({ ...s, lead_tier: null, is_unseen: undefined }));
    } else {
      rows = signals || [];
    }

    let hotCount = 0;
    let warmCount = 0;
    let unseenCount = 0;
    const subredditCounts = new Map<string, number>();

    for (const row of rows) {
      // Derive tier for old signals without lead_tier
      let tier = row.lead_tier;
      if (!tier) {
        if (row.combined_score >= 0.7) tier = 'hot';
        else if (row.combined_score >= 0.4) tier = 'warm';
        else tier = 'cold';
      }

      if (tier === 'hot') hotCount++;
      else if (tier === 'warm') warmCount++;

      if (row.is_unseen) unseenCount++;

      subredditCounts.set(row.subreddit, (subredditCounts.get(row.subreddit) || 0) + 1);
    }

    // Top subreddits sorted by count
    const topSubreddits = Array.from(subredditCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      hotCount,
      warmCount,
      unseenCount,
      totalCount: rows.length,
      topSubreddits,
    });
  } catch (error) {
    console.error('Signals analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
