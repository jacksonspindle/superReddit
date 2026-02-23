import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const VALID_STAGES = ['detected', 'dm_ready', 'draft_generated', 'dm_sent', 'responded', 'converted', 'closed'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dm_id, pipeline_stage, notes, outcome, last_reply_text } = body;

    if (!dm_id) {
      return NextResponse.json({ error: 'dm_id is required' }, { status: 400 });
    }

    if (pipeline_stage && !VALID_STAGES.includes(pipeline_stage)) {
      return NextResponse.json({ error: 'Invalid pipeline stage' }, { status: 400 });
    }

    // Must have at least one field to update
    if (!pipeline_stage && !notes && !outcome && !last_reply_text) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    const update: Record<string, unknown> = {};
    if (pipeline_stage) update.pipeline_stage = pipeline_stage;
    if (notes !== undefined) update.notes = notes;
    if (outcome !== undefined) update.outcome = outcome;
    if (last_reply_text !== undefined) update.last_reply_text = last_reply_text;

    const { error } = await supabase
      .from('outreach_dms')
      .update(update)
      .eq('id', dm_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DM stage update error:', error);
    return NextResponse.json({ error: 'Failed to update DM stage' }, { status: 500 });
  }
}
