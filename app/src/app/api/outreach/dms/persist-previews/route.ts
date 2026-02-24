import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** Strip u/ or /u/ prefix, trim, lowercase — so "u/FooBar" → "foobar" */
function normalizeUsername(raw: string): string {
  return raw.replace(/^\/?u\//, '').trim().toLowerCase();
}

/**
 * Batch-persist chat preview text for DMs:
 * - "You:" previews → dm_body (what user sent)
 * - Their replies → last_reply_text (what they sent back)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, previews, sender_username } = body as {
      project_id: string;
      previews: Record<string, { text: string; fromYou: boolean; theirText?: string | null }>;
      sender_username?: string;
    };

    if (!project_id || !previews || Object.keys(previews).length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Defense-in-depth: reject if sender Reddit account doesn't match project config
    if (sender_username) {
      const { data: config } = await supabase
        .from('outreach_configs')
        .select('reddit_username')
        .eq('project_id', project_id)
        .maybeSingle();

      if (config?.reddit_username) {
        const senderNorm = normalizeUsername(sender_username);
        const configNorm = normalizeUsername(config.reddit_username);
        if (senderNorm !== configNorm) {
          return NextResponse.json(
            { error: 'Account mismatch: sender does not match project Reddit account' },
            { status: 409 },
          );
        }
      }
    }

    // Get all DMs for this project in sent/responded stages
    const { data: dms } = await supabase
      .from('outreach_dms')
      .select('id, reddit_username, dm_body, last_reply_text, pipeline_stage')
      .eq('project_id', project_id)
      .in('pipeline_stage', ['dm_sent', 'responded']);

    if (!dms || dms.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    let updated = 0;
    for (const dm of dms) {
      const key = dm.reddit_username.toLowerCase();
      const preview = previews[key];
      if (!preview?.text) continue;

      const updates: Record<string, string> = {};

      // Save what you sent as dm_body (only if not already set)
      if (preview.fromYou && !dm.dm_body) {
        updates.dm_body = preview.text;
      }
      if (!preview.fromYou && !dm.dm_body) {
        // They replied but we don't have your sent text — you must have sent first
      }

      // Save their reply text: use theirText (preserved across your replies) or direct text
      const theirReply = preview.theirText || (!preview.fromYou ? preview.text : null);
      if (theirReply && dm.last_reply_text !== theirReply) {
        updates.last_reply_text = theirReply;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('outreach_dms')
          .update(updates)
          .eq('id', dm.id);
        if (!error) updated++;
      }
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error('Persist previews error:', error);
    return NextResponse.json({ error: 'Failed to persist previews' }, { status: 500 });
  }
}
