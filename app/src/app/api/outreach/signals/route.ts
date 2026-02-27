import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/outreach/signals
 * Returns existing signals from DB instantly — no scanning.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

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
        .order('combined_score', { ascending: false })
        .order('created_utc', { ascending: false });

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
        return NextResponse.json({ signals: [] });
      }

      return NextResponse.json({ signals: signals || [] });
    } catch {
      return NextResponse.json({ signals: [] });
    }
  } catch (error) {
    console.error('Signals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
