import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dm_id, dm_content, follow_up_days } = body;

    if (!dm_id) {
      return NextResponse.json({ error: 'dm_id is required' }, { status: 400 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Get current DM to increment touch number
    const { data: current } = await supabase
      .from('outreach_dms')
      .select('touch_number')
      .eq('id', dm_id)
      .single();

    const touchNumber = (current?.touch_number ?? 0) + 1;

    const update: Record<string, unknown> = {
      pipeline_stage: 'dm_sent',
      dm_sent_at: new Date().toISOString(),
      touch_number: touchNumber,
    };

    if (dm_content) update.dm_body = dm_content;

    if (follow_up_days && follow_up_days > 0) {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + follow_up_days);
      update.follow_up_due = followUpDate.toISOString();
    }

    const { error } = await supabase
      .from('outreach_dms')
      .update(update)
      .eq('id', dm_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DM sent update error:', error);
    return NextResponse.json({ error: 'Failed to mark DM as sent' }, { status: 500 });
  }
}
