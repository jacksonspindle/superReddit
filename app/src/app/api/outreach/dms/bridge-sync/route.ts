import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** Strip u/ or /u/ prefix, trim, lowercase — so "u/FooBar" → "foobar" */
function normalizeUsername(raw: string): string {
  return raw.replace(/^\/?u\//, '').trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, youSentTo, theyReplied } = body as {
      project_id: string;
      youSentTo: string[];
      theyReplied: string[];
    };

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get existing pipeline entries — group ALL entries per username (not just one)
    const { data: existing } = await supabase
      .from('outreach_dms')
      .select('id, reddit_username, pipeline_stage')
      .eq('project_id', project_id);

    type DmEntry = { id: string; reddit_username: string; pipeline_stage: string };
    const existingByUsername = new Map<string, DmEntry[]>();
    for (const dm of existing || []) {
      const key = normalizeUsername(dm.reddit_username);
      const arr = existingByUsername.get(key) || [];
      arr.push(dm);
      existingByUsername.set(key, arr);
    }

    const repliedSet = new Set((theyReplied || []).map(normalizeUsername));
    const sentSet = new Set((youSentTo || []).map(normalizeUsername));


    let created = 0;
    let advanced = 0;

    // 1. Create new entries for users not in pipeline
    const toInsert: { project_id: string; reddit_username: string; pipeline_stage: string; source_thread_permalink: string; permission_type: string; permission_score: number }[] = [];

    // Users you sent to (not yet in pipeline)
    for (const username of sentSet) {
      if (existingByUsername.has(username)) continue;
      const stage = repliedSet.has(username) ? 'responded' : 'dm_sent';
      toInsert.push({
        project_id,
        reddit_username: username,
        pipeline_stage: stage,
        source_thread_permalink: `chat://${username}`,
        permission_type: 'direct_chat',
        permission_score: 1,
      });
    }

    // Users who replied but weren't in youSentTo (edge case)
    for (const username of repliedSet) {
      if (existingByUsername.has(username)) continue;
      if (sentSet.has(username)) continue; // already handled above
      toInsert.push({
        project_id,
        reddit_username: username,
        pipeline_stage: 'responded',
        source_thread_permalink: `chat://${username}`,
        permission_type: 'direct_chat',
        permission_score: 1,
      });
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('outreach_dms')
        .upsert(toInsert, {
          onConflict: 'project_id,reddit_username,source_thread_permalink',
          ignoreDuplicates: true,
        });
      if (error) {
        console.error('Bridge sync insert error:', error);
      } else {
        created = toInsert.length;
      }
    }

    // 2. Advance existing entries that should be in dm_sent or responded
    //    Process ALL entries per username (a user may appear in multiple threads)
    const readyStages = new Set(['detected', 'dm_ready', 'draft_generated']);

    for (const [username, dms] of existingByUsername) {
      for (const dm of dms) {
        // Advance READY → dm_sent (or responded) if user sent a DM
        if (readyStages.has(dm.pipeline_stage) && sentSet.has(username)) {
          const newStage = repliedSet.has(username) ? 'responded' : 'dm_sent';
          await supabase.from('outreach_dms').update({ pipeline_stage: newStage }).eq('id', dm.id);
          advanced++;
        }
        // Advance dm_sent → responded if they replied
        else if (dm.pipeline_stage === 'dm_sent' && repliedSet.has(username)) {
          await supabase.from('outreach_dms').update({ pipeline_stage: 'responded' }).eq('id', dm.id);
          advanced++;
        }
      }
    }

    // 3. Reconciliation pass — re-query DB and verify ALL entries match extension truth
    let reconciled = 0;
    const skipStages = new Set(['closed', 'converted']);

    const { data: allEntries } = await supabase
      .from('outreach_dms')
      .select('id, reddit_username, pipeline_stage')
      .eq('project_id', project_id);

    for (const entry of allEntries || []) {
      if (skipStages.has(entry.pipeline_stage)) continue;
      const uname = normalizeUsername(entry.reddit_username);

      if (repliedSet.has(uname) && entry.pipeline_stage !== 'responded') {
        await supabase.from('outreach_dms').update({ pipeline_stage: 'responded' }).eq('id', entry.id);
        reconciled++;
      } else if (sentSet.has(uname) && !repliedSet.has(uname) && readyStages.has(entry.pipeline_stage)) {
        await supabase.from('outreach_dms').update({ pipeline_stage: 'dm_sent' }).eq('id', entry.id);
        reconciled++;
      }
    }

    console.log(`[Bridge Sync] sent=${sentSet.size} replied=${repliedSet.size} existing=${existingByUsername.size} → created=${created} advanced=${advanced} reconciled=${reconciled}`);
    return NextResponse.json({ created, advanced, reconciled });
  } catch (error) {
    console.error('Bridge sync error:', error);
    return NextResponse.json({ error: 'Failed to sync bridge data' }, { status: 500 });
  }
}
