import { Client, EmbedBuilder } from 'discord.js';

interface DmSignalPayload {
  title: string;
  subreddit: string;
  matchedKeywords: string[];
  snippet: string;
  redditUrl: string;
  redditAuthor: string | null;
  signalTypes: string[];
  combinedScore: number;
  painSeverity: string | null;
  decisionMaker: boolean;
  detectedAt: string;
}

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

function getScoreColor(score: number): number {
  if (score >= 0.7) return 0x22c55e;
  if (score >= 0.4) return 0xf59e0b;
  return 0xef4444;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Send a signal alert as a Discord DM to a user.
 */
export async function sendDmAlert(
  client: Client,
  discordUserId: string,
  signal: DmSignalPayload
): Promise<boolean> {
  try {
    const user = await client.users.fetch(discordUserId);
    if (!user) {
      console.error(`Could not fetch Discord user ${discordUserId}`);
      return false;
    }

    const typeBadges = signal.signalTypes
      .map((t) => `${SIGNAL_TYPE_BADGES[t] || '📌'} ${t.replace(/_/g, ' ')}`)
      .join(' | ');

    const appUrl = process.env.APP_URL || 'https://superreddit.app';

    const embed = new EmbedBuilder()
      .setTitle(truncate(signal.title, 256))
      .setURL(signal.redditUrl)
      .setColor(getScoreColor(signal.combinedScore))
      .setTimestamp(new Date(signal.detectedAt))
      .setFooter({ text: `SuperReddit | View in app: ${appUrl}` });

    if (signal.snippet) {
      embed.setDescription(truncate(signal.snippet, 300));
    }

    embed.addFields(
      { name: 'Subreddit', value: `r/${signal.subreddit}`, inline: true },
      { name: 'Score', value: `${signal.combinedScore.toFixed(2)}`, inline: true }
    );

    if (signal.signalTypes.length > 0) {
      embed.addFields({ name: 'Signal Types', value: typeBadges, inline: false });
    }

    if (signal.matchedKeywords.length > 0) {
      embed.addFields({
        name: 'Matched Keywords',
        value: signal.matchedKeywords.map((k) => `\`${k}\``).join(', '),
        inline: false,
      });
    }

    if (signal.painSeverity) {
      embed.addFields({
        name: 'Pain Severity',
        value: `${PAIN_BADGES[signal.painSeverity] || ''} ${signal.painSeverity}`,
        inline: true,
      });
    }

    if (signal.decisionMaker) {
      embed.addFields({ name: 'Decision Maker', value: '👔 Yes', inline: true });
    }

    if (signal.redditAuthor) {
      embed.addFields({ name: 'Author', value: `u/${signal.redditAuthor}`, inline: true });
    }

    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Failed to DM user ${discordUserId}:`, error);
    return false;
  }
}
