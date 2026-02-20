import { ChatInputCommandInteraction } from 'discord.js';
import { supabase } from '../db/supabase.js';

/**
 * Guard: check that the interaction is happening in the configured
 * #superreddit-alerts channel for this guild.
 * Returns the alert_config row if valid, or null (and replies with error).
 */
export async function inAlertChannel(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return null;
  }

  const { data: config, error } = await supabase
    .from('alert_configs')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .single();

  if (error || !config) {
    await interaction.reply({
      content: 'No alert configuration found for this server. Please connect via the SuperReddit web app first.',
      ephemeral: true,
    });
    return null;
  }

  if (interaction.channelId !== config.channel_id) {
    await interaction.reply({
      content: `Please use this command in the <#${config.channel_id}> channel.`,
      ephemeral: true,
    });
    return null;
  }

  return config;
}
