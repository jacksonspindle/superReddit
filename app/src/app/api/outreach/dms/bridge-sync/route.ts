import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** Strip u/ or /u/ prefix, trim, lowercase — so "u/FooBar" → "foobar" */
function normalizeUsername(raw: string): string {
  return raw.replace(/^\/?u\//, '').trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, youSentTo, theyReplied, previews } = body as {
      project_id: string;
      youSentTo: string[];
      theyReplied: string[];
      previews?: Record<string, { text: string; fromYou: boolean }>;
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

    // Helpers: get preview text for a username from extension previews
    function getYouPreview(username: string): string | null {
      if (!previews) return null;
      const p = previews[username];
      return (p?.fromYou && p?.text) ? p.text : null;
    }
    function getReplyPreview(username: string): string | null {
      if (!previews) return null;
      const p = previews[username];
      return (!p?.fromYou && p?.text) ? p.text : null;
    }

    let created = 0;
    let advanced = 0;

    // 1. Create new entries for users not in pipeline
    const toInsert: {
      project_id: string;
      reddit_username: string;
      pipeline_stage: string;
      source_thread_permalink: string;
      permission_type: string;
      permission_score: number;
      dm_body?: string;
      dm_sent_at?: string;
    }[] = [];

    // Users you sent to (not yet in pipeline)
    for (const username of sentSet) {
      if (existingByUsername.has(username)) continue;
      const stage = repliedSet.has(username) ? 'responded' : 'dm_sent';
      const entry: typeof toInsert[number] = {
        project_id,
        reddit_username: username,
        pipeline_stage: stage,
        source_thread_permalink: `chat://${username}`,
        permission_type: 'direct_chat',
        permission_score: 1,
      };
      const previewText = getYouPreview(username);
      if (previewText) {
        entry.dm_body = previewText;
        entry.dm_sent_at = new Date().toISOString();
      }
      toInsert.push(entry);
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

    // 4. Persist preview text for entries: dm_body (what you sent) + last_reply_text (what they replied)
    let previewsPersisted = 0;
    if (previews && Object.keys(previews).length > 0) {
      const { data: dmsToPersist } = await supabase
        .from('outreach_dms')
        .select('id, reddit_username, dm_body, last_reply_text')
        .eq('project_id', project_id)
        .in('pipeline_stage', ['dm_sent', 'responded']);

      for (const dm of dmsToPersist || []) {
        const uname = normalizeUsername(dm.reddit_username);
        const updates: Record<string, string> = {};

        const youText = getYouPreview(uname);
        if (youText && !dm.dm_body) updates.dm_body = youText;

        const replyText = getReplyPreview(uname);
        if (replyText && dm.last_reply_text !== replyText) updates.last_reply_text = replyText;

        if (Object.keys(updates).length > 0) {
          await supabase.from('outreach_dms').update(updates).eq('id', dm.id);
          previewsPersisted++;
        }
      }
    }

    console.log(`[Bridge Sync] sent=${sentSet.size} replied=${repliedSet.size} existing=${existingByUsername.size} → created=${created} advanced=${advanced} reconciled=${reconciled} previewsPersisted=${previewsPersisted}`);
    return NextResponse.json({ created, advanced, reconciled, previewsPersisted });
  } catch (error) {
    console.error('Bridge sync error:', error);
    return NextResponse.json({ error: 'Failed to sync bridge data' }, { status: 500 });
  }
}
