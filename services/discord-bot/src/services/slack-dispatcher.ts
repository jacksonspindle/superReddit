import { supabase } from '../db/supabase.js';

interface SlackAlertPayload {
  title: string;
  subreddit: string;
  matchedKeywords: string[];
  snippet: string;
  redditUrl: string;
  signalTypes: string[];
  combinedScore: number;
  painSeverity: string | null;
}

export async function sendSlackAlert(webhookUrl: string, payload: SlackAlertPayload): Promise<boolean> {
  // Build Slack Block Kit message
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: truncate(payload.title, 150), emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Subreddit:*\nr/${payload.subreddit}` },
        { type: 'mrkdwn', text: `*Score:*\n${payload.combinedScore.toFixed(2)}` },
      ]
    },
  ];

  if (payload.matchedKeywords.length > 0) {
    blocks.push({
      type: 'section',
      fields: [{ type: 'mrkdwn', text: `*Keywords:*\n${payload.matchedKeywords.map(k => '`' + k + '`').join(', ')}` }]
    });
  }

  if (payload.snippet) {
    blocks.push({
      type: 'section',
      fields: [{ type: 'mrkdwn', text: truncate(payload.snippet, 300) }]
    });
  }

  blocks.push({
    type: 'actions',
    elements: [{ type: 'button', text: { type: 'plain_text', text: 'View on Reddit' }, url: payload.redditUrl }]
  } as any);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    return response.ok;
  } catch (error) {
    console.error('Slack webhook error:', error);
    return false;
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 3) + '...';
}
