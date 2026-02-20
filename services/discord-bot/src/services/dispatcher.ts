import { supabase } from '../db/supabase.js';

interface AlertEmbed {
  matchId: string;
  title: string;
  subreddit: string;
  matchedPhrase: string;
  snippet: string;
  redditUrl: string;
  redditAuthor: string | null;
  detectedAt: string;
}

/**
 * Send a webhook embed to the configured Discord channel.
 */
export async function sendAlertEmbed(
  webhookUrl: string,
  alert: AlertEmbed
): Promise<boolean> {
  const embed = {
    title: truncate(alert.title, 256),
    url: alert.redditUrl,
    color: 0xff4500, // Reddit orange
    description: alert.snippet ? truncate(alert.snippet, 300) : undefined,
    fields: [
      {
        name: 'Subreddit',
        value: `r/${alert.subreddit}`,
        inline: true,
      },
      {
        name: 'Matched Phrase',
        value: `\`${alert.matchedPhrase}\``,
        inline: true,
      },
      ...(alert.redditAuthor
        ? [
            {
              name: 'Author',
              value: `u/${alert.redditAuthor}`,
              inline: true,
            },
          ]
        : []),
    ],
    timestamp: alert.detectedAt,
    footer: {
      text: 'SuperReddit Alert',
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      console.error(`Webhook failed (${response.status}):`, await response.text());
      await updateMatchStatus(alert.matchId, 'failed');
      return false;
    }

    await updateMatchStatus(alert.matchId, 'sent');
    return true;
  } catch (error) {
    console.error('Webhook delivery error:', error);
    await updateMatchStatus(alert.matchId, 'failed');
    return false;
  }
}

/**
 * Process all pending matches for a project and send them.
 */
export async function dispatchPendingAlerts(
  projectId: string,
  webhookUrl: string
): Promise<number> {
  const { data: pending, error } = await supabase
    .from('alert_matches')
    .select('*')
    .eq('project_id', projectId)
    .eq('alert_status', 'pending')
    .order('detected_at', { ascending: true });

  if (error || !pending?.length) return 0;

  let sentCount = 0;

  for (const match of pending) {
    const success = await sendAlertEmbed(webhookUrl, {
      matchId: match.id,
      title: match.title,
      subreddit: match.subreddit,
      matchedPhrase: match.matched_phrase || 'unknown',
      snippet: match.snippet || '',
      redditUrl: match.reddit_url,
      redditAuthor: match.reddit_author,
      detectedAt: match.detected_at,
    });

    if (success) sentCount++;

    // Rate limit: small delay between embeds
    await sleep(500);
  }

  return sentCount;
}

async function updateMatchStatus(matchId: string, status: 'sent' | 'failed') {
  await supabase
    .from('alert_matches')
    .update({
      alert_status: status,
      alert_sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', matchId);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
