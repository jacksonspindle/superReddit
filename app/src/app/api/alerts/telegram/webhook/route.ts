import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const update = await request.json();
    const message = update?.message;

    if (!message?.text?.startsWith('/start ')) {
      return NextResponse.json({ ok: true });
    }

    // Extract the token from the /start command
    const token = message.text.slice('/start '.length).trim();

    // Look up the pending connection by token (must not be expired)
    const { data: pending, error: lookupError } = await supabase
      .from('pending_telegram_connections')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (lookupError) {
      console.error('Pending connection lookup error:', lookupError);
      return NextResponse.json({ ok: true });
    }

    if (!pending) {
      // Token not found or expired - notify user
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: 'Invalid or expired link. Please try connecting again from SuperReddit.',
          }),
        }
      );
      return NextResponse.json({ ok: true });
    }

    // Update outreach_configs with Telegram details
    const { error: updateError } = await supabase
      .from('outreach_configs')
      .update({
        telegram_chat_id: message.chat.id.toString(),
        telegram_username: message.from.username || message.from.first_name,
        telegram_connected: true,
      })
      .eq('project_id', pending.project_id);

    if (updateError) {
      console.error('Failed to update outreach config:', updateError);
      return NextResponse.json({ ok: true });
    }

    // Delete the pending connection row
    await supabase
      .from('pending_telegram_connections')
      .delete()
      .eq('id', pending.id);

    // Send confirmation message to user
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: "Connected! You'll now receive SuperReddit alerts here.",
        }),
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}
