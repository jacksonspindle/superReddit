const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramAlertPayload {
  title: string;
  subreddit: string;
  matchedKeywords: string[];
  snippet: string;
  redditUrl: string;
  combinedScore: number;
  painSeverity: string | null;
}

export async function sendTelegramAlert(chatId: string, payload: TelegramAlertPayload): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return false;
  }

  const keywords = payload.matchedKeywords.map(k => `\`${k}\``).join(', ');

  // Build Telegram message with MarkdownV2-safe formatting
  // Use HTML parse mode for simpler escaping
  const text = [
    `<b>${escapeHtml(payload.title)}</b>`,
    ``,
    `<b>Subreddit:</b> r/${escapeHtml(payload.subreddit)}`,
    `<b>Score:</b> ${payload.combinedScore.toFixed(2)}`,
    payload.matchedKeywords.length ? `<b>Keywords:</b> ${payload.matchedKeywords.map(k => `<code>${escapeHtml(k)}</code>`).join(', ')}` : '',
    payload.painSeverity ? `<b>Pain:</b> ${payload.painSeverity}` : '',
    payload.snippet ? `\n${escapeHtml(payload.snippet.slice(0, 200))}` : '',
    ``,
    `<a href="${payload.redditUrl}">View on Reddit</a>`,
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Telegram dispatch error:', error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
