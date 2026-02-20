import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const DAILY_LIMIT = 20;
const WEEKLY_LIMIT = 100;
const SPACING_SECONDS = 120; // 2 minutes

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();
    const now = new Date();

    // Count first-touch DMs in last 24 hours
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount } = await supabase
      .from('outreach_dms')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('first_touch_sent_at', dayAgo);

    // Count first-touch DMs in last 7 days
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: weeklyCount } = await supabase
      .from('outreach_dms')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('first_touch_sent_at', weekAgo);

    // Get most recent first-touch send time for spacing check
    const { data: lastSend } = await supabase
      .from('outreach_dms')
      .select('first_touch_sent_at')
      .eq('project_id', projectId)
      .not('first_touch_sent_at', 'is', null)
      .order('first_touch_sent_at', { ascending: false })
      .limit(1)
      .single();

    const daily = dailyCount ?? 0;
    const weekly = weeklyCount ?? 0;

    const lastSendTime = lastSend?.first_touch_sent_at
      ? new Date(lastSend.first_touch_sent_at)
      : null;

    const spacingOk = !lastSendTime ||
      (now.getTime() - lastSendTime.getTime()) >= SPACING_SECONDS * 1000;

    const canSend = daily < DAILY_LIMIT && weekly < WEEKLY_LIMIT && spacingOk;

    // Calculate nextSendAt based on whichever limit is the bottleneck
    let nextSendAt: string | null = null;

    if (!canSend) {
      const candidates: Date[] = [];

      // Spacing constraint
      if (!spacingOk && lastSendTime) {
        candidates.push(new Date(lastSendTime.getTime() + SPACING_SECONDS * 1000));
      }

      // Daily limit — need to wait until the oldest send in 24h window expires
      if (daily >= DAILY_LIMIT) {
        const { data: oldestDaily } = await supabase
          .from('outreach_dms')
          .select('first_touch_sent_at')
          .eq('project_id', projectId)
          .gte('first_touch_sent_at', dayAgo)
          .order('first_touch_sent_at', { ascending: true })
          .limit(1)
          .single();

        if (oldestDaily?.first_touch_sent_at) {
          candidates.push(new Date(
            new Date(oldestDaily.first_touch_sent_at).getTime() + 24 * 60 * 60 * 1000
          ));
        }
      }

      // Weekly limit — need to wait until the oldest send in 7d window expires
      if (weekly >= WEEKLY_LIMIT) {
        const { data: oldestWeekly } = await supabase
          .from('outreach_dms')
          .select('first_touch_sent_at')
          .eq('project_id', projectId)
          .gte('first_touch_sent_at', weekAgo)
          .order('first_touch_sent_at', { ascending: true })
          .limit(1)
          .single();

        if (oldestWeekly?.first_touch_sent_at) {
          candidates.push(new Date(
            new Date(oldestWeekly.first_touch_sent_at).getTime() + 7 * 24 * 60 * 60 * 1000
          ));
        }
      }

      if (candidates.length > 0) {
        const earliest = new Date(Math.min(...candidates.map((d) => d.getTime())));
        nextSendAt = earliest.toISOString();
      }
    }

    const cooldownSeconds = nextSendAt
      ? Math.max(0, Math.ceil((new Date(nextSendAt).getTime() - now.getTime()) / 1000))
      : 0;

    return NextResponse.json({
      canSend,
      dailyCount: daily,
      weeklyCount: weekly,
      dailyLimit: DAILY_LIMIT,
      weeklyLimit: WEEKLY_LIMIT,
      nextSendAt,
      cooldownSeconds,
    });
  } catch (error) {
    console.error('Rate limit check error:', error);
    return NextResponse.json({ error: 'Failed to check rate limit' }, { status: 500 });
  }
}
