import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailAlertPayload {
  title: string;
  subreddit: string;
  matchedKeywords: string[];
  snippet: string;
  redditUrl: string;
  combinedScore: number;
  painSeverity: string | null;
}

export async function sendEmailAlert(emailAddress: string, payload: EmailAlertPayload): Promise<boolean> {
  try {
    const keywordsHtml = payload.matchedKeywords.map(k => `<code>${k}</code>`).join(', ');

    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="margin-bottom: 4px;">${escapeHtml(payload.title)}</h2>
        <p style="color: #666; margin-top: 0;">r/${escapeHtml(payload.subreddit)} &middot; Score: ${payload.combinedScore.toFixed(2)}</p>
        ${payload.snippet ? `<p style="color: #333;">${escapeHtml(payload.snippet.slice(0, 300))}</p>` : ''}
        ${payload.matchedKeywords.length ? `<p><strong>Keywords:</strong> ${keywordsHtml}</p>` : ''}
        <p><a href="${payload.redditUrl}" style="color: #0066cc;">View on Reddit &rarr;</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;" />
        <p style="color: #999; font-size: 12px;">SuperReddit Alert</p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: 'SuperReddit Alerts <alerts@superreddit.app>',
      to: emailAddress,
      subject: `[SuperReddit] ${payload.title.slice(0, 80)}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Email dispatch error:', error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
