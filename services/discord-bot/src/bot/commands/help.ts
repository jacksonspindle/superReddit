import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { inAlertChannel } from '../checks.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all available SuperReddit alert commands');

export async function execute(interaction: ChatInputCommandInteraction) {
  const config = await inAlertChannel(interaction);
  if (!config) return;

  const embed = new EmbedBuilder()
    .setTitle('SuperReddit Alerts — Commands')
    .setColor(0xff4500)
    .setDescription('Manage your Reddit keyword alerts directly from Discord.')
    .addFields(
      {
        name: '/help',
        value: 'Show this help message.',
        inline: false,
      },
      {
        name: '/add keyword <phrases>',
        value:
          'Add a keyword group to monitor. Use commas to separate phrases.\nExample: `/add keyword saas,startup,indie hacker`',
        inline: false,
      },
      {
        name: '/add subreddit <name>',
        value:
          'Add a subreddit to monitor.\nExample: `/add subreddit entrepreneur`',
        inline: false,
      },
      {
        name: '/remove <keyword> [duration]',
        value:
          'Remove a phrase from monitoring. Optionally silence it temporarily.\nExample: `/remove saas` (permanent) or `/remove saas 20m` (silenced for 20 minutes)',
        inline: false,
      }
    )
    .setFooter({ text: 'SuperReddit — Reddit Marketing Made Easy' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
