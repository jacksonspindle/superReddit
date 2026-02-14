import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reply_id, signal_id } = body;

    if (!reply_id) {
      return NextResponse.json({ error: 'reply_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Mark reply as copied
    const { error: replyError } = await supabase
      .from('outreach_replies')
      .update({ status: 'copied' })
      .eq('id', reply_id);

    if (replyError) {
      return NextResponse.json({ error: replyError.message }, { status: 500 });
    }

    // Mark signal as replied
    if (signal_id) {
      await supabase
        .from('outreach_signals')
        .update({ status: 'replied' })
        .eq('id', signal_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reply copied error:', error);
    return NextResponse.json({ error: 'Failed to mark reply as copied' }, { status: 500 });
  }
}
