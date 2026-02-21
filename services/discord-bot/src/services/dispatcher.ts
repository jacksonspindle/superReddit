import { supabase } from '../db/supabase.js';

interface SignalEmbed {
  signalId: string;
  title: string;
  subreddit: string;
  matchedKeywords: string[];
  snippet: string;
  redditUrl: string;
  redditAuthor: string | null;
  signalTypes: string[];
  intentScore: number;
  combinedScore: number;
  painSeverity: string | null;
  decisionMaker: boolean;
  safetyLevel: string | null;
  detectedAt: string;
}

// Badge emojis for signal types
const SIGNAL_TYPE_BADGES: Record<string, string> = {
  tool_switch: '🔄',
  budget_constraint: '💰',
  repeated_pain: '😫',
  high_signal_comment: '🎯',
  mod_safe: '✅',
  trend_cluster: '📈',
  convertible_thread: '🔥',
};

const PAIN_BADGES: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

const SCORE_COLOR: Record<string, number> = {
  high: 0x22c55e,    // green
  medium: 0xf59e0b,  // amber
  low: 0xef4444,     // red
};

function getScoreColor(score: number): number {
  if (score >= 0.7) return SCORE_COLOR.high;
  if (score >= 0.4) return SCORE_COLOR.medium;
  return SCORE_COLOR.low;
}

/**
 * Send an enhanced webhook embed to Discord.
 */
export async function sendSignalEmbed(
  webhookUrl: string,
  signal: SignalEmbed
): Promise<boolean> {
  // Build signal type badges string
  const typeBadges = signal.signalTypes
    .map((t) => `${SIGNAL_TYPE_BADGES[t] || '📌'} ${t.replace(/_/g, ' ')}`)
    .join(' | ');

  const fields = [
    {
      name: 'Subreddit',
      value: `r/${signal.subreddit}`,
      inline: true,
    },
    {
      name: 'Score',
      value: `${signal.combinedScore.toFixed(2)}`,
      inline: true,
    },
  ];

  if (signal.signalTypes.length > 0) {
    fields.push({
      name: 'Signal Types',
      value: typeBadges,
      inline: false,
    });
  }

  if (signal.matchedKeywords.length > 0) {
    fields.push({
      name: 'Matched Keywords',
      value: signal.matchedKeywords.map((k) => `\`${k}\``).join(', '),
      inline: false,
    });
  }

  if (signal.painSeverity) {
    fields.push({
      name: 'Pain Severity',
      value: `${PAIN_BADGES[signal.painSeverity] || ''} ${signal.painSeverity}`,
      inline: true,
    });
  }

  if (signal.decisionMaker) {
    fields.push({
      name: 'Decision Maker',
      value: '👔 Yes',
      inline: true,
    });
  }

  if (signal.redditAuthor) {
    fields.push({
      name: 'Author',
      value: `u/${signal.redditAuthor}`,
      inline: true,
    });
  }

  const appUrl = process.env.APP_URL || 'https://superreddit.app';

  const embed = {
    title: truncate(signal.title, 256),
    url: signal.redditUrl,
    color: getScoreColor(signal.combinedScore),
    description: signal.snippet ? truncate(signal.snippet, 300) : undefined,
    fields,
    timestamp: signal.detectedAt,
    footer: {
      text: `SuperReddit | View in app: ${appUrl}`,
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
      await updateSignalAlertStatus(signal.signalId, 'failed');
      return false;
    }

    await updateSignalAlertStatus(signal.signalId, 'sent');
    return true;
  } catch (error) {
    console.error('Webhook delivery error:', error);
    await updateSignalAlertStatus(signal.signalId, 'failed');
    return false;
  }
}

/**
 * Process all pending signals for a project and dispatch Discord alerts.
 */
export async function dispatchPendingAlerts(
  projectId: string,
  webhookUrl: string
): Promise<number> {
  const { data: pending, error } = await supabase
    .from('outreach_signals')
    .select('*')
    .eq('project_id', projectId)
    .eq('discord_alert_status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !pending?.length) return 0;

  let sentCount = 0;

  for (const signal of pending) {
    const success = await sendSignalEmbed(webhookUrl, {
      signalId: signal.id,
      title: signal.title,
      subreddit: signal.subreddit,
      matchedKeywords: signal.matched_keywords || [],
      snippet: signal.body || '',
      redditUrl: `https://reddit.com${signal.permalink}`,
      redditAuthor: signal.author,
      signalTypes: signal.signal_types || [],
      intentScore: signal.intent_score || 0,
      combinedScore: signal.combined_score || 0,
      painSeverity: signal.pain_severity,
      decisionMaker: signal.decision_maker || false,
      safetyLevel: null,
      detectedAt: signal.fetched_at || signal.created_at,
    });

    if (success) sentCount++;

    // Rate limit: small delay between embeds
    await sleep(500);
  }

  return sentCount;
}

async function updateSignalAlertStatus(
  signalId: string,
  status: 'sent' | 'failed'
) {
  await supabase
    .from('outreach_signals')
    .update({
      discord_alert_status: status,
      discord_alert_sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', signalId);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
