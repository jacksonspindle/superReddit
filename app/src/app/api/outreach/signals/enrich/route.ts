import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { classifyPostsRealtime, reclassifyWithSonnet } from '@/lib/outreach/signal-classifier';
import { computeEnhancedScore } from '@/lib/outreach/scoring';

/**
 * Internal endpoint for the Discord bot to trigger AI enrichment on matched posts.
 * Protected by API key (not user auth).
 */
export async function POST(request: NextRequest) {
  // Verify API key
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.ENRICHMENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { project_id, reddit_id } = await request.json();

  if (!project_id || !reddit_id) {
    return NextResponse.json(
      { error: 'project_id and reddit_id are required' },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // Fetch the signal
  const { data: signal, error: signalError } = await supabase
    .from('outreach_signals')
    .select('*')
    .eq('project_id', project_id)
    .eq('reddit_id', reddit_id)
    .single();

  if (signalError || !signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }

  // Fetch project config for product context
  const { data: config } = await supabase
    .from('outreach_configs')
    .select('competitors')
    .eq('project_id', project_id)
    .single();

  const { data: project } = await supabase
    .from('projects')
    .select('product_name, product_description')
    .eq('id', project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const competitors = config?.competitors || [];

  // Classify with Haiku
  const results = await classifyPostsRealtime(
    [
      {
        reddit_id: signal.reddit_id,
        title: signal.title,
        body: signal.body,
        subreddit: signal.subreddit,
        author: signal.author,
        score: signal.score,
        num_comments: signal.num_comments,
      },
    ],
    project.product_name,
    project.product_description,
    competitors
  );

  let classification = results[0];

  // Sonnet fallback for ambiguous (medium bin)
  if (classification?.score_bin === 'medium') {
    const sonnetResults = await reclassifyWithSonnet(
      [
        {
          reddit_id: signal.reddit_id,
          title: signal.title,
          body: signal.body,
          subreddit: signal.subreddit,
          author: signal.author,
          score: signal.score,
          num_comments: signal.num_comments,
        },
      ],
      project.product_name,
      project.product_description,
      competitors
    );
    if (sonnetResults[0]) {
      classification = sonnetResults[0];
    }
  }

  if (!classification) {
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 });
  }

  // Compute enhanced score
  const hasSwitchingIntent = classification.competitor_mentions.some(
    (c) => c.switching_intent
  );
  const combinedScore = computeEnhancedScore({
    intentScore: classification.intent_score,
    createdUtc: signal.created_utc,
    redditScore: signal.score,
    numComments: signal.num_comments,
    competitorMentioned: classification.competitor_mentions.length > 0,
    switchingIntent: hasSwitchingIntent,
  });

  // Update the signal
  await supabase
    .from('outreach_signals')
    .update({
      intent_type: classification.intent_type,
      intent_score: classification.intent_score,
      combined_score: combinedScore,
      signal_types: classification.signal_types,
      pain_severity: classification.pain_severity,
      decision_maker: classification.decision_maker,
      competitor_mentioned: classification.competitor_mentions.length > 0,
    })
    .eq('id', signal.id);

  // Insert competitor mentions
  if (classification.competitor_mentions.length > 0) {
    const mentions = classification.competitor_mentions.map((cm) => ({
      project_id,
      signal_id: signal.id,
      competitor_name: cm.name,
      mention_context: cm.context,
      sentiment: cm.sentiment,
      switching_intent: cm.switching_intent,
    }));

    await supabase.from('competitor_mentions').insert(mentions);
  }

  return NextResponse.json({ enriched: true, classification });
}
