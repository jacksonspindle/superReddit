import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { detectSignalsV3 } from '@/lib/outreach/detector';
import {
  enqueueProject,
  dequeueProjects,
  markCompleted,
  markFailed,
  cleanupOldEntries,
} from '@/lib/outreach/poll-queue';

export const maxDuration = 300;

/**
 * Vercel Cron endpoint: queue-based signal polling.
 * Runs every 5 minutes. Each invocation:
 * 1. Enqueues active projects that haven't been polled in 30+ minutes
 * 2. Dequeues and processes a batch of 5 projects (high priority first)
 * 3. Cleans up completed entries older than 1 hour
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel injects this header for cron jobs)
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Phase 1: Enqueue active projects that need polling
  let enqueued = 0;
  try {
    const { data: configs } = await supabase
      .from('outreach_configs')
      .select('project_id')
      .eq('polling_enabled', true)
      .eq('setup_completed', true);

    if (configs?.length) {
      // Find projects not polled in last 30 minutes
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      for (const config of configs) {
        // Check last completed scan
        const { data: lastScan } = await supabase
          .from('signal_poll_queue')
          .select('completed_at')
          .eq('project_id', config.project_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const needsPoll = !lastScan || !lastScan.completed_at || lastScan.completed_at < thirtyMinAgo;

        if (needsPoll) {
          await enqueueProject(supabase, config.project_id, 'normal');
          enqueued++;
        }
      }
    }
  } catch (err) {
    console.error('Cron enqueue error:', err);
  }

  // Phase 2: Dequeue and process batch
  let processed = 0;
  let totalSignals = 0;

  try {
    const batch = await dequeueProjects(supabase, 5);

    for (const entry of batch) {
      try {
        // Get project details
        const { data: project } = await supabase
          .from('projects')
          .select('product_name, product_description')
          .eq('id', entry.project_id)
          .single();

        if (!project) {
          await markFailed(supabase, entry.id, 'Project not found');
          continue;
        }

        // Get config
        const { data: config } = await supabase
          .from('outreach_configs')
          .select('keywords, competitors, subreddit_limit')
          .eq('project_id', entry.project_id)
          .maybeSingle();

        // Get monitored subreddits
        const { data: subs } = await supabase
          .from('outreach_monitored_subs')
          .select('name')
          .eq('project_id', entry.project_id)
          .eq('is_active', true);

        let subredditNames: string[] = (subs || []).map((s: { name: string }) => s.name);
        if (subredditNames.length === 0) {
          const { data: projectSubs } = await supabase
            .from('subreddits')
            .select('name')
            .eq('project_id', entry.project_id);
          subredditNames = (projectSubs || []).map((s: { name: string }) => s.name);
        }

        const keywords = (config?.keywords as string[]) || [];
        if (subredditNames.length === 0 || keywords.length === 0) {
          await markFailed(supabase, entry.id, 'No subreddits or keywords configured');
          continue;
        }

        const count = await detectSignalsV3(supabase, {
          projectId: entry.project_id,
          keywords,
          competitors: (config?.competitors as string[]) || [],
          subreddits: subredditNames,
          subredditLimit: (config?.subreddit_limit as number) || 100,
          productName: project.product_name,
          productDescription: project.product_description,
          realtime: entry.priority === 'high',
          browseSubreddits: true,
        });

        await markCompleted(supabase, entry.id, count);
        totalSignals += count;
        processed++;
      } catch (err) {
        console.error(`Cron process error for project ${entry.project_id}:`, err);
        await markFailed(supabase, entry.id, (err as Error).message);
      }
    }
  } catch (err) {
    console.error('Cron dequeue error:', err);
  }

  // Phase 3: Cleanup old entries
  try {
    await cleanupOldEntries(supabase);
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    enqueued,
    processed,
    signals: totalSignals,
  });
}
