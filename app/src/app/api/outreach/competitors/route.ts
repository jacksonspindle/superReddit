import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const projectId = request.nextUrl.searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  // Fetch all competitor mentions with their associated signals
  const { data: mentions, error } = await supabase
    .from('competitor_mentions')
    .select(`
      id,
      competitor_name,
      mention_context,
      sentiment,
      switching_intent,
      created_at,
      signal_id,
      outreach_signals (
        id,
        title,
        subreddit,
        permalink,
        author,
        score,
        num_comments,
        created_utc,
        combined_score,
        signal_types,
        pain_severity
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by competitor
  const competitorMap = new Map<
    string,
    {
      name: string;
      totalMentions: number;
      sentiment: { positive: number; neutral: number; negative: number };
      switchingIntentCount: number;
      topSubreddits: Map<string, number>;
      mentions: typeof mentions;
    }
  >();

  for (const mention of mentions || []) {
    const name = mention.competitor_name;
    if (!competitorMap.has(name)) {
      competitorMap.set(name, {
        name,
        totalMentions: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        switchingIntentCount: 0,
        topSubreddits: new Map(),
        mentions: [],
      });
    }

    const comp = competitorMap.get(name)!;
    comp.totalMentions++;
    comp.sentiment[mention.sentiment as keyof typeof comp.sentiment]++;
    if (mention.switching_intent) comp.switchingIntentCount++;

    const signal = mention.outreach_signals as unknown as { subreddit: string } | null;
    if (signal?.subreddit) {
      comp.topSubreddits.set(
        signal.subreddit,
        (comp.topSubreddits.get(signal.subreddit) || 0) + 1
      );
    }

    comp.mentions!.push(mention);
  }

  // Build response
  const competitors = Array.from(competitorMap.values()).map((comp) => ({
    name: comp.name,
    totalMentions: comp.totalMentions,
    sentimentBreakdown: comp.sentiment,
    switchingIntentCount: comp.switchingIntentCount,
    topSubreddits: Array.from(comp.topSubreddits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name),
  }));

  return NextResponse.json({ competitors, mentions: mentions || [] });
}
