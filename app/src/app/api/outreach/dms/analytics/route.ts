import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Fetch all DMs for this project
    const { data: dms, error: dmsError } = await supabase
      .from('outreach_dms')
      .select('id, pipeline_stage, source_signal_id, created_at, dm_sent_at, outcome, reddit_username')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (dmsError) {
      return NextResponse.json({ error: dmsError.message }, { status: 500 });
    }

    // Fetch replies with their signal info (for "best performing responses")
    const { data: replies, error: repliesError } = await supabase
      .from('outreach_replies')
      .select('id, signal_id, thread_permalink, current_score, reply_count, op_replied, status, posted_at, signal:outreach_signals(title, subreddit, permalink)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (repliesError) {
      return NextResponse.json({ error: repliesError.message }, { status: 500 });
    }

    // Fetch signals for "top performing posts" (posts we replied to that generated leads)
    const { data: signals, error: signalsError } = await supabase
      .from('outreach_signals')
      .select('id, title, subreddit, permalink, score, num_comments, status, created_utc')
      .eq('project_id', projectId)
      .order('created_utc', { ascending: false });

    if (signalsError) {
      return NextResponse.json({ error: signalsError.message }, { status: 500 });
    }

    // --- Compute pipeline stage counts ---
    const stageCounts = {
      detected: 0,
      dm_ready: 0,
      draft_generated: 0,
      dm_sent: 0,
      responded: 0,
      follow_up: 0,
      converted: 0,
      closed: 0,
    };

    for (const dm of dms ?? []) {
      const stage = dm.pipeline_stage as string;
      if (stage in stageCounts) {
        stageCounts[stage as keyof typeof stageCounts]++;
      }
    }

    // Count follow-ups due
    const followUpCount = (dms ?? []).filter(
      (d) => d.pipeline_stage === 'dm_sent' && d.dm_sent_at
    ).length;

    // --- Compute daily pipeline trends (last 30 days) ---
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyMap = new Map<string, { detected: number; ready: number; sent: number; follow_up: number; converted: number }>();

    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, { detected: 0, ready: 0, sent: 0, follow_up: 0, converted: 0 });
    }

    for (const dm of dms ?? []) {
      const day = dm.created_at?.split('T')[0];
      if (day && dailyMap.has(day)) {
        const entry = dailyMap.get(day)!;
        entry.detected++;
        if (dm.pipeline_stage === 'dm_ready' || dm.pipeline_stage === 'draft_generated') entry.ready++;
        if (dm.pipeline_stage === 'dm_sent') entry.sent++;
        if (dm.pipeline_stage === 'responded') entry.follow_up++;
        if (dm.pipeline_stage === 'converted') entry.converted++;
      }
    }

    const dailyTrends = Array.from(dailyMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    // --- Top performing posts (signals that generated the most DM leads) ---
    const signalLeadCounts = new Map<string, number>();
    const signalConvertedCounts = new Map<string, number>();
    for (const dm of dms ?? []) {
      if (dm.source_signal_id) {
        signalLeadCounts.set(dm.source_signal_id, (signalLeadCounts.get(dm.source_signal_id) || 0) + 1);
        if (dm.pipeline_stage === 'converted') {
          signalConvertedCounts.set(dm.source_signal_id, (signalConvertedCounts.get(dm.source_signal_id) || 0) + 1);
        }
      }
    }

    const topPosts = (signals ?? [])
      .map((s) => ({
        id: s.id,
        title: s.title,
        subreddit: s.subreddit,
        permalink: s.permalink,
        score: s.score,
        num_comments: s.num_comments,
        leads: signalLeadCounts.get(s.id) || 0,
        converted: signalConvertedCounts.get(s.id) || 0,
      }))
      .filter((s) => s.leads > 0)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);

    // --- Best performing responses (replies with the most engagement/leads) ---
    const replyLeadCounts = new Map<string, number>();
    for (const dm of dms ?? []) {
      if (dm.source_signal_id) {
        // Group by signal since replies are tied to signals
        replyLeadCounts.set(dm.source_signal_id, (replyLeadCounts.get(dm.source_signal_id) || 0) + 1);
      }
    }

    const bestResponses = (replies ?? [])
      .map((r) => ({
        id: r.id,
        signal_id: r.signal_id,
        thread_permalink: r.thread_permalink,
        current_score: r.current_score || 0,
        reply_count: r.reply_count || 0,
        op_replied: r.op_replied,
        status: r.status,
        posted_at: r.posted_at,
        signal_title: (r.signal as { title?: string } | null)?.title || 'Unknown thread',
        subreddit: (r.signal as { subreddit?: string } | null)?.subreddit || '',
        leads_generated: r.signal_id ? (replyLeadCounts.get(r.signal_id) || 0) : 0,
      }))
      .filter((r) => r.leads_generated > 0 || r.reply_count > 0 || r.op_replied)
      .sort((a, b) => b.leads_generated - a.leads_generated || b.reply_count - a.reply_count)
      .slice(0, 10);

    return NextResponse.json({
      stageCounts,
      followUpCount,
      dailyTrends,
      topPosts,
      bestResponses,
      totalDms: (dms ?? []).length,
    });
  } catch (error) {
    console.error('DM analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
