import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseComplianceProfile, computeSafetyScore } from '@/lib/outreach/compliance';

const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';
const REDDIT_BASE = 'https://www.reddit.com';

export async function GET(request: NextRequest) {
  try {
    const subreddit = request.nextUrl.searchParams.get('subreddit');
    if (!subreddit) {
      return NextResponse.json({ error: 'subreddit is required' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Check cache first
    const { data: cached } = await supabase
      .from('subreddit_rules')
      .select('*')
      .eq('subreddit', subreddit)
      .maybeSingle();

    // Return cached if analyzed within last 24h
    if (cached && cached.analyzed_at) {
      const age = Date.now() - new Date(cached.analyzed_at).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ rules: cached });
      }
    }

    // Fetch rules from Reddit
    const url = `${REDDIT_BASE}/r/${subreddit}/about/rules.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch rules for r/${subreddit}` },
        { status: response.status }
      );
    }

    const json = await response.json() as { rules?: Record<string, unknown>[] };
    const rulesJson = json.rules || [];
    const complianceProfile = parseComplianceProfile(rulesJson);
    const safetyScore = computeSafetyScore(complianceProfile);

    // Upsert to cache
    const { data: saved, error } = await supabase
      .from('subreddit_rules')
      .upsert(
        {
          subreddit,
          rules_json: rulesJson,
          compliance_profile: complianceProfile,
          safety_score: safetyScore,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: 'subreddit' }
      )
      .select()
      .single();

    if (error) {
      // Still return the data even if cache save failed
      return NextResponse.json({
        rules: {
          subreddit,
          rules_json: rulesJson,
          compliance_profile: complianceProfile,
          safety_score: safetyScore,
        },
      });
    }

    return NextResponse.json({ rules: saved });
  } catch (error) {
    console.error('Subreddit rules error:', error);
    return NextResponse.json({ error: 'Failed to fetch subreddit rules' }, { status: 500 });
  }
}
